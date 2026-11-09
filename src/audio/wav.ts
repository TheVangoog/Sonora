// Writes 16-bit PCM mono. Reads 16/24-bit PCM and 32-bit float, mono or stereo (mixed down).
export type DecodedAudio = { samples: Float32Array; sampleRate: number };

export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeText = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true); // size of everything after this field
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true); // size of the format block
  view.setUint16(20, 1, true); // 1 = PCM (uncompressed integers)
  view.setUint16(22, 1, true); // 1 channel (mono)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // bytes per second
  view.setUint16(32, bytesPerSample, true); // bytes per sample frame
  view.setUint16(34, 16, true); // bits per sample
  writeText(36, "data");
  view.setUint32(40, dataSize, true);

  // −1 … +1 → −32768 … 32767. Values outside are clipped.
  samples.forEach((sample, i) => {
    const clipped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * bytesPerSample, Math.round(clipped * 32767), true);
  });
  return buffer;
}

export function decodeWav(bytes: ArrayBuffer): DecodedAudio {
  const view = new DataView(bytes);
  const text = (offset: number, length: number) =>
    String.fromCharCode(...new Uint8Array(bytes, offset, length));
  if (text(0, 4) !== "RIFF" || text(8, 4) !== "WAVE") {
    throw new Error("Not a WAV file.");
  }

  // A WAV file is a list of "chunks"; we need "fmt " (format) and "data".
  let format = 0, channels = 0, sampleRate = 0, bitsPerSample = 0;
  let dataOffset = -1, dataSize = 0;
  for (let offset = 12; offset + 8 <= bytes.byteLength; ) {
    const id = text(offset, 4);
    const size = view.getUint32(offset + 4, true);
    if (id === "fmt ") {
      format = view.getUint16(offset + 8, true);
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
      // 0xFFFE = "extensible": the real format code sits further inside.
      if (format === 0xfffe) format = view.getUint16(offset + 32, true);
    } else if (id === "data") {
      dataOffset = offset + 8;
      dataSize = Math.min(size, bytes.byteLength - dataOffset);
    }
    offset += 8 + size + (size % 2); // chunks are padded to an even size
  }
  if (dataOffset < 0 || !channels) throw new Error("WAV file without format or data.");

  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(dataSize / (bytesPerSample * channels));
  const readSample = (position: number): number => {
    if (format === 3 && bitsPerSample === 32) return view.getFloat32(position, true);
    if (format === 1 && bitsPerSample === 16) return view.getInt16(position, true) / 32768;
    if (format === 1 && bitsPerSample === 24) {
      const value =
        view.getUint8(position) |
        (view.getUint8(position + 1) << 8) |
        (view.getInt8(position + 2) << 16);
      return value / 8388608;
    }
    throw new Error(`Unsupported WAV format: code ${format}, ${bitsPerSample} bits.`);
  };

  // Mix all channels into one (average), so stereo recordings work too.
  const samples = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame++) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel++) {
      sum += readSample(dataOffset + (frame * channels + channel) * bytesPerSample);
    }
    samples[frame] = sum / channels;
  }
  return { samples, sampleRate };
}
