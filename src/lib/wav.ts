// WAV/PCM helpers shared by the audio tools. Everything here runs on raw
// AudioBuffer data in the browser — no network, no workers required.

/** Encode an AudioBuffer as 16-bit PCM WAV. */
export function encodeWav16(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels
  const frames = buffer.length
  const bytesPerSample = 2
  const blockAlign = channels * bytesPerSample
  const dataSize = frames * blockAlign
  const out = new ArrayBuffer(44 + dataSize)
  const view = new DataView(out)

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, channels, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)

  // Interleave channels as int16.
  const data: Float32Array[] = []
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c))
  let offset = 44
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([out], { type: 'audio/wav' })
}

/** Absolute peak across all channels. */
export function peakOf(buffer: AudioBuffer): number {
  let peak = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c)
    for (let i = 0; i < d.length; i++) {
      const a = Math.abs(d[i])
      if (a > peak) peak = a
    }
  }
  return peak
}

/** RMS across all channels (perceived loudness proxy). */
export function rmsOf(buffer: AudioBuffer): number {
  let sum = 0
  let count = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c)
    for (let i = 0; i < d.length; i++) {
      sum += d[i] * d[i]
      count++
    }
  }
  return count ? Math.sqrt(sum / count) : 0
}

/**
 * Compute the gain for a normalization mode.
 * - peak: loudest sample lands exactly on the ceiling (default -1 dBFS)
 * - rms: perceived level lands on the target, then a peak ceiling is enforced
 */
export function normalizeGain(
  buffer: AudioBuffer,
  mode: 'peak' | 'rms',
  targetDb: number,
): number {
  const target = 10 ** (targetDb / 20)
  if (mode === 'peak') {
    const peak = peakOf(buffer)
    return peak > 0 ? target / peak : 1
  }
  const rms = rmsOf(buffer)
  if (rms <= 0) return 1
  let gain = target / rms
  // enforce the peak ceiling after the loudness gain
  const ceiling = 10 ** (-1 / 20)
  const peak = peakOf(buffer)
  if (peak * gain > ceiling) gain = ceiling / peak
  return gain
}

/** Apply equal-power fade in/out (seconds) to the buffer, in place. */
export function applyFades(buffer: AudioBuffer, fadeInS: number, fadeOutS: number): void {
  const rate = buffer.sampleRate
  const len = buffer.length
  const fi = Math.min(Math.round(fadeInS * rate), Math.floor(len / 2))
  const fo = Math.min(Math.round(fadeOutS * rate), Math.floor(len / 2))
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c)
    for (let i = 0; i < fi; i++) {
      // equal-power: amplitude curve of cos/sin keeps perceived volume even
      const t = i / Math.max(fi, 1)
      d[i] *= Math.sin((t * Math.PI) / 2)
    }
    for (let i = 0; i < fo; i++) {
      const t = i / Math.max(fo, 1)
      d[len - 1 - i] *= Math.sin((t * Math.PI) / 2)
    }
  }
}

/**
 * Slice a buffer between two times, optionally applying a speed factor by
 * linear-interpolation resampling (playback-rate semantics: faster = shorter
 * AND pitched up, like tape). Returns a new AudioBuffer at `ctx`'s rate.
 */
export function renderClip(
  source: AudioBuffer,
  startS: number,
  endS: number,
  speed: number,
  gain: number,
): AudioBuffer {
  const rate = source.sampleRate
  const start = Math.max(0, Math.floor(startS * rate))
  const end = Math.min(source.length, Math.ceil(endS * rate))
  const srcFrames = Math.max(0, end - start)
  const outFrames = Math.max(1, Math.floor(srcFrames / speed))
  const channels = source.numberOfChannels
  const out = new AudioBuffer({
    length: outFrames,
    numberOfChannels: channels,
    sampleRate: rate,
  })
  const src: Float32Array[] = []
  for (let c = 0; c < channels; c++) src.push(source.getChannelData(c))
  for (let c = 0; c < channels; c++) {
    const dst = out.getChannelData(c)
    const d = src[c]
    for (let i = 0; i < outFrames; i++) {
      // linear interpolation between the two nearest source samples
      const pos = start + i * speed
      const i0 = Math.floor(pos)
      const frac = pos - i0
      const a = d[Math.min(i0, srcFrames - 1 + start)] ?? 0
      const b = d[Math.min(i0 + 1, srcFrames - 1 + start)] ?? 0
      dst[i] = (a + (b - a) * frac) * gain
    }
  }
  return out
}

/** Concatenate buffers, resampling mismatched rates via linear interpolation. */
export function concatBuffers(buffers: AudioBuffer[]): AudioBuffer {
  if (buffers.length === 1) return buffers[0]
  const rate = buffers[0].sampleRate
  const channels = Math.max(...buffers.map((b) => b.numberOfChannels))
  let total = 0
  for (const b of buffers) total += Math.ceil((b.length * rate) / b.sampleRate)
  const out = new AudioBuffer({ length: total, numberOfChannels: channels, sampleRate: rate })
  let offset = 0
  for (const b of buffers) {
    const frames = Math.ceil((b.length * rate) / b.sampleRate)
    for (let c = 0; c < channels; c++) {
      const dst = out.getChannelData(c)
      const src = b.getChannelData(Math.min(c, b.numberOfChannels - 1))
      const scale = b.sampleRate === rate ? 1 : b.sampleRate / rate
      for (let i = 0; i < frames; i++) {
        const pos = i * scale
        const i0 = Math.floor(pos)
        const frac = pos - i0
        const a = src[Math.min(i0, src.length - 1)] ?? 0
        const bx = src[Math.min(i0 + 1, src.length - 1)] ?? 0
        dst[offset + i] = a + (bx - a) * frac
      }
    }
    offset += frames
  }
  return out
}
