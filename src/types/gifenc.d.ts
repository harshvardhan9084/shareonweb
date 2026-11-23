// Type declarations for gifenc (ships no .d.ts). Only the surface this app
// uses is declared: quantize + applyPalette for GIF frame encoding, and the
// GIFEncoder stream. Verified against gifenc@1.0.3 dist exports.
declare module 'gifenc' {
  export interface QuantizeOptions {
    format?: 'rgb565' | 'rgb444' | 'rgba4444'
    oneBitAlpha?: boolean | number
    clearAlpha?: boolean
    clearAlphaColor?: number
    clearAlphaThreshold?: number
    useSqrt?: boolean
  }

  export type Palette = number[][]

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: QuantizeOptions,
  ): Palette

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array

  export interface GIFEncoderOptions {
    initialCapacity?: number
    auto?: boolean
  }

  export interface WriteFrameOptions {
    palette?: Palette
    delay?: number
    repeat?: number
    transparent?: boolean
    transparentIndex?: number
    dispose?: number
    colorDepth?: number
    first?: boolean
  }

  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: WriteFrameOptions,
    ): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    reset(): void
  }

  export function GIFEncoder(options?: GIFEncoderOptions): GIFEncoderInstance

  export function nearestColorIndex(palette: Palette, pixel: number[]): number
  export function prequantize(
    rgba: Uint8Array | Uint8ClampedArray,
    options?: { roundRGB?: number; roundAlpha?: number; oneBitAlpha?: boolean | number },
  ): void
}
