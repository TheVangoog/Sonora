import { useEffect, useRef, useState } from "react";
import { FRAME_SIZE, measureSignal } from "../audio/signal.ts";

type Props = {
  running: boolean;
  sampleRate: number | null;
  readFrame: () => { samples: Float32Array; sampleRate: number } | null;
  // Only for the label.
  frameSize?: number;
};
const silence = { rms: 0, peak: 0, dbfs: -Infinity };

export default function SignalMonitor({
  running,
  sampleRate,
  readFrame,
  frameSize = FRAME_SIZE,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState(silence);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let request = 0;
    let lastUpdate = -Infinity;
    setLevel(silence);

    function draw(time: number) {
      if (!canvas || !context) return;
      const frame = running ? readFrame() : null;
      const { width, height } = canvas;
      context.clearRect(0, 0, width, height);
      context.strokeStyle = "#dce4f1";
      context.lineWidth = 1;
      context.beginPath();
      [0.25, 0.5, 0.75].forEach((y) => {
        context.moveTo(0, height * y);
        context.lineTo(width, height * y);
      });
      context.stroke();
      context.strokeStyle = frame ? "#305ce8" : "#a7b4cc";
      context.lineWidth = 2;
      context.beginPath();
      if (frame) {
        frame.samples.forEach((value, index) => {
          const x = (index / (frame.samples.length - 1)) * width;
          const y =
            height / 2 - Math.max(-1, Math.min(1, value)) * height * 0.45;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        // Canvas every frame; the numbers in React at most 10 times per second.
        if (time - lastUpdate >= 100) {
          setLevel(measureSignal(frame.samples));
          lastUpdate = time;
        }
      } else {
        context.moveTo(0, height / 2);
        context.lineTo(width, height / 2);
      }
      context.stroke();
      if (running) request = requestAnimationFrame(draw);
    }
    draw(0);
    return () => cancelAnimationFrame(request);
  }, [running, readFrame]);

  const meterValue = Math.max(-60, Math.min(0, level.dbfs));
  const signalLabel = !running
    ? "Source stopped"
    : level.peak >= 0.99
      ? "Signal close to clipping"
      : level.dbfs < -55
        ? "Quiet signal"
        : "Signal coming in";

  return (
    <section className="signal-monitor" aria-label="Live audio signal">
      <div className="signal-heading">
        <strong>Your signal over time</strong>
        <span>{signalLabel}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={900}
        height={180}
        role="img"
        aria-label="Waveform: time horizontally, amplitude vertically"
      />
      <div className="signal-axis">
        <span>0 ms</span>
        <span>amplitude −1 … +1</span>
        <span>
          {sampleRate ? ((frameSize / sampleRate) * 1000).toFixed(1) : "—"} ms
        </span>
      </div>
      <label className="level-meter">
        Signal level{" "}
        <meter
          min={-60}
          max={0}
          value={meterValue}
          aria-label="Digital level from −60 to 0 dBFS"
        />
        <output>
          {running
            ? Number.isFinite(level.dbfs)
              ? level.dbfs.toFixed(1)
              : "−∞"
            : "—"}{" "}
          dBFS
        </output>
      </label>
      <dl className="signal-stats">
        <div>
          <dt>RMS</dt>
          <dd>{running ? level.rms.toFixed(4) : "—"}</dd>
        </div>
        <div>
          <dt>Sample rate</dt>
          <dd>{sampleRate ? `${(sampleRate / 1000).toFixed(1)} kHz` : "—"}</dd>
        </div>
        <div>
          <dt>Window size</dt>
          <dd>{frameSize} samples</dd>
        </div>
      </dl>
    </section>
  );
}
