import type { CSSProperties } from 'react'

type Rgb = [number, number, number]

function hexToRgb(hex: string): Rgb | null {
  const value = hex.trim().replace(/^#/, '')
  if (/^[0-9a-f]{6}$/i.test(value)) {
    return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)]
  }
  if (/^[0-9a-f]{3}$/i.test(value)) {
    return [parseInt(value[0] + value[0], 16), parseInt(value[1] + value[1], 16), parseInt(value[2] + value[2], 16)]
  }
  return null
}

function mix([r, g, b]: Rgb, [r2, g2, b2]: Rgb, t: number): Rgb {
  return [Math.round(r + (r2 - r) * t), Math.round(g + (g2 - g) * t), Math.round(b + (b2 - b) * t)]
}

const triplet = ([r, g, b]: Rgb) => `${r} ${g} ${b}`
const toHex = ([r, g, b]: Rgb) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`

/**
 * CSS custom properties that re-theme the brand accent for a subtree. Returns
 * undefined for an empty/invalid colour, so the NGG defaults apply. Derives a
 * darker "coral" and a light "sage" tint from the single accent the client picks.
 */
export function brandingStyle(accentColor?: string): CSSProperties | undefined {
  if (!accentColor) return undefined
  const base = hexToRgb(accentColor)
  if (!base) return undefined
  const coral = mix(base, [0, 0, 0], 0.16)
  const active = mix(base, [0, 0, 0], 0.3)
  const sage = mix(base, [255, 255, 255], 0.9)
  return {
    '--c-forest': triplet(base),
    '--c-coral': triplet(coral),
    '--c-sage': triplet(sage),
    '--ngg-accent': toHex(base),
    '--ngg-accent-hover': toHex(coral),
    '--ngg-accent-active': toHex(active),
    '--ngg-accent-soft': toHex(sage),
  } as CSSProperties
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('לא ניתן היה לקרוא את הקובץ.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('קובץ התמונה אינו תקין.'))
    img.src = src
  })
}

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

/**
 * Validate and normalise an uploaded logo into a small data: URL. Raster images are
 * downscaled and re-encoded (which also strips any embedded metadata); the result is
 * capped so it stays light enough to travel inside the simulation record.
 */
export async function readLogoDataUrl(file: File): Promise<string> {
  if (!ACCEPTED.includes(file.type)) throw new Error('יש להעלות קובץ תמונה מסוג PNG, JPG, WEBP או SVG.')
  if (file.size > 4 * 1024 * 1024) throw new Error('הקובץ גדול מדי. יש להעלות תמונה במשקל של עד 4MB.')

  const original = await readFileAsDataUrl(file)
  let image: HTMLImageElement
  try {
    image = await loadImage(original)
  } catch {
    throw new Error('קובץ התמונה אינו תקין. נסו קובץ אחר.')
  }

  const maxDim = 320
  const width = image.width || maxDim
  const height = image.height || maxDim
  const scale = Math.min(1, maxDim / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return original
  ctx.drawImage(image, 0, 0, w, h)

  let out = canvas.toDataURL('image/png')
  if (out.length > 200_000) out = canvas.toDataURL('image/jpeg', 0.85)
  return out
}
