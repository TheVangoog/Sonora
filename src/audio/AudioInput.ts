import { audioErrorMessage, FRAME_SIZE } from "./signal.ts";
import { HISTORY_WORKLET, SoundHistory } from "./soundHistory.ts";

export type AudioMode = "microphone" | "demo";
export type InputStatus = "idle" | "starting" | "running" | "paused" | "error";
export type InputState = {
  status: InputStatus;
  mode: AudioMode | null;
  sampleRate: number | null;
  error: string | null;
};
export const idleState: InputState = {
  status: "idle",
  mode: null,
  sampleRate: null,
  error: null,
};

type Session = {
  context: AudioContext;
  analyser: AnalyserNode;
  mute: GainNode;
  samples: Float32Array<ArrayBuffer>;
  source?: AudioNode;
  stream?: MediaStream;
  oscillators: OscillatorNode[];
  amplitude?: GainNode;
  // Only when historySeconds > 0: the worklet and the last seconds of sound.
  capture?: AudioWorkletNode;
  history?: SoundHistory;
  ready: boolean;
};

// frameSize: 2048 for the tuner, 8192 for chords.
// historySeconds > 0 also keeps that much continuous sound for the AI (see readHistory()).
export class AudioInput {
  private generation = 0;
  private session: Session | null = null;
  private demoFrequencies = [440];
  private demoWaveform: OscillatorType = "sine";
  private amplitude = 0.2;
  private notify: (state: InputState) => void;
  private readonly frameSize: number;
  private readonly historySeconds: number;

  constructor(
    notify: (state: InputState) => void,
    frameSize = FRAME_SIZE,
    historySeconds = 0,
  ) {
    this.notify = notify;
    this.frameSize = frameSize;
    this.historySeconds = historySeconds;
  }

  async start(mode: AudioMode): Promise<void> {
    this.stop();
    const generation = this.generation;
    this.notify({ ...idleState, status: "starting", mode });

    try {
      this.checkBrowserSupport(mode);
      const session = this.createSession();
      this.session = session;
      await session.context.resume();
      if (generation !== this.generation) return;

      if (mode === "microphone") {
        await this.connectMicrophone(session, generation);
      } else {
        this.connectDemo(session);
      }

      if (generation !== this.generation) return;
      if (this.historySeconds > 0) await this.connectHistory(session);
      if (generation !== this.generation) return;
      session.ready = true;
      this.watchContextState(session, mode, generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.reportError(audioErrorMessage(error));
    }
  }

  private checkBrowserSupport(mode: AudioMode): void {
    if (typeof AudioContext === "undefined") {
      throw new Error("This browser does not support the Web Audio API.");
    }
    if (
      mode === "microphone" &&
      (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia)
    ) {
      throw new Error(
        "To use the microphone, open the site over HTTPS or localhost. Chrome or Edge may help.",
      );
    }
  }

  private createSession(): Session {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = this.frameSize;
    const mute = context.createGain();
    mute.gain.value = 0;
    analyser.connect(mute);
    mute.connect(context.destination);

    return {
      context,
      analyser,
      mute,
      samples: new Float32Array(this.frameSize),
      oscillators: [],
      ready: false,
    };
  }

  private async connectMicrophone(
    session: Session,
    generation: number,
  ): Promise<void> {
    const stream = await this.requestMicrophone();
    if (generation !== this.generation) {
      this.stopStream(stream);
      return;
    }

    session.stream = stream;
    const tracks = this.getLiveAudioTracks(stream);
    this.watchMicrophoneTracks(tracks, generation);
    session.source = session.context.createMediaStreamSource(stream);
    session.source.connect(session.analyser);
  }

  private requestMicrophone(): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        channelCount: { ideal: 1 },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  }

  private getLiveAudioTracks(stream: MediaStream): MediaStreamTrack[] {
    const tracks = stream.getAudioTracks();
    if (
      !tracks.length ||
      tracks.some((track) => track.readyState === "ended")
    ) {
      throw new Error(
        "The microphone stream ended. Try connecting it again.",
      );
    }
    return tracks;
  }

  private watchMicrophoneTracks(
    tracks: MediaStreamTrack[],
    generation: number,
  ): void {
    tracks.forEach((track) => {
      track.onended = () => {
        if (generation !== this.generation) return;
        this.reportError(
          "The microphone was disconnected or access was revoked. Connect it again.",
        );
      };
    });
  }

  // Demo graph: oscillators → one shared gain → analyser.
  private connectDemo(session: Session): void {
    const amplitude = session.context.createGain();
    session.amplitude = amplitude;
    session.source = amplitude;
    amplitude.gain.value = this.demoGain();
    amplitude.connect(session.analyser);
    this.startDemoOscillators(session);
  }

  private startDemoOscillators(session: Session): void {
    if (!session.amplitude) return;
    for (const frequency of this.demoFrequencies) {
      const oscillator = session.context.createOscillator();
      oscillator.type = this.demoWaveform;
      oscillator.frequency.value = frequency;
      oscillator.connect(session.amplitude);
      oscillator.start();
      session.oscillators.push(oscillator);
    }
  }

  // Several oscillators share one level, so each gets an equal part of it.
  private demoGain(): number {
    return this.amplitude / this.demoFrequencies.length;
  }

  // source → history worklet → silent output. The worklet sends the
  // sound in chunks; we keep the newest `historySeconds` of it.
  private async connectHistory(session: Session): Promise<void> {
    const url = URL.createObjectURL(
      new Blob([HISTORY_WORKLET], { type: "text/javascript" }),
    );
    try {
      await session.context.audioWorklet.addModule(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const history = new SoundHistory(
      Math.round(this.historySeconds * session.context.sampleRate),
    );
    const capture = new AudioWorkletNode(session.context, "sonora-history");
    capture.port.onmessage = (event) => history.push(event.data);
    session.source?.connect(capture);
    capture.connect(session.mute);
    session.capture = capture;
    session.history = history;
  }

  private watchContextState(
    session: Session,
    mode: AudioMode,
    generation: number,
  ): void {
    const publishState = () => {
      if (generation !== this.generation) return;
      this.publishContextState(session.context, mode);
    };
    session.context.onstatechange = publishState;
    publishState();
  }

  private publishContextState(context: AudioContext, mode: AudioMode): void {
    if (context.state === "closed") {
      this.reportError("The audio context was closed. Start the source again.");
      return;
    }
    this.notify({
      status: context.state === "running" ? "running" : "paused",
      mode,
      sampleRate: context.sampleRate,
      error: null,
    });
  }

  private reportError(message: string): void {
    this.stop();
    this.notify({ ...idleState, status: "error", error: message });
  }

  readFrame() {
    const session = this.session;
    if (!session?.ready || session.context.state !== "running") return null;
    session.analyser.getFloatTimeDomainData(session.samples);
    return { samples: session.samples, sampleRate: session.context.sampleRate };
  }

  // The newest `seconds` of continuous sound (a fresh copy), or null
  // when history is off, audio is not running, or not enough has been heard yet.
  readHistory(seconds: number) {
    const session = this.session;
    if (!session?.ready || !session.history || session.context.state !== "running") {
      return null;
    }
    const sampleRate = session.context.sampleRate;
    const samples = session.history.latest(Math.round(seconds * sampleRate));
    return samples ? { samples, sampleRate } : null;
  }

  setDemo(frequency: number, amplitude: number) {
    const tone = Math.min(1000, Math.max(100, frequency));
    this.applyDemo([tone], amplitude, "sine");
  }

  // Several tones at once, e.g. the six strings of an open chord.
  // "sawtooth" contains all harmonics, so it resembles a plucked string more than "sine".
  setDemoTones(
    frequencies: number[],
    amplitude: number,
    waveform: OscillatorType = "sawtooth",
  ) {
    const tones = frequencies.map((f) => Math.min(2000, Math.max(40, f)));
    if (tones.length) this.applyDemo(tones, amplitude, waveform);
  }

  private applyDemo(
    frequencies: number[],
    amplitude: number,
    waveform: OscillatorType,
  ) {
    this.demoFrequencies = frequencies;
    this.demoWaveform = waveform;
    this.amplitude = Math.min(0.8, Math.max(0, amplitude));

    const session = this.session;
    if (!session?.amplitude) return; // Not running a demo: the settings wait for start().
    const now = session.context.currentTime;

    const sameShape =
      session.oscillators.length === frequencies.length &&
      session.oscillators.every((oscillator) => oscillator.type === waveform);
    if (sameShape) {
      session.oscillators.forEach((oscillator, i) =>
        oscillator.frequency.setTargetAtTime(frequencies[i], now, 0.01),
      );
    } else {
      // A different number of tones: replace the oscillators.
      this.stopOscillators(session);
      this.startDemoOscillators(session);
    }
    session.amplitude.gain.setTargetAtTime(this.demoGain(), now, 0.01);
  }

  stop() {
    this.generation++;
    const session = this.session;
    this.session = null;
    if (session) this.releaseSession(session);
    this.notify(idleState);
  }

  private releaseSession(session: Session): void {
    session.context.onstatechange = null;
    if (session.stream) this.stopStream(session.stream);
    this.stopOscillators(session);
    session.source?.disconnect();
    session.amplitude?.disconnect();
    session.analyser.disconnect();
    if (session.capture) {
      session.capture.port.onmessage = null;
      session.capture.disconnect();
    }
    session.mute.disconnect();
    if (session.context.state !== "closed") {
      void session.context.close().catch(() => {});
    }
  }

  private stopStream(stream: MediaStream): void {
    stream.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
  }

  private stopOscillators(session: Session): void {
    for (const oscillator of session.oscillators) {
      try {
        oscillator.stop();
      } catch {
        // The source may not have started yet.
      }
      oscillator.disconnect();
    }
    session.oscillators = [];
  }

  dispose() {
    this.notify = () => {};
    this.stop();
  }
}
