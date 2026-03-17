export type RGB = [number, number, number]

export interface GenerateMosaicOptions {
  sourceImage: HTMLImageElement
  targetWidth: number
  targetHeight: number
  blockSize: number
  cornerRadius: number
  paletteSize: number
}

export interface GenerateMosaicResult {
  blob: Blob
  palette: RGB[]
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })

export const getSuggestedOutputSize = (
  image: HTMLImageElement,
  baseWidth = 720,
  minHeight = 240,
) => {
  const ratio = image.naturalWidth / image.naturalHeight
  return {
    width: baseWidth,
    height: Math.max(minHeight, Math.round(baseWidth / ratio)),
  }
}

const colorDistance = (a: RGB, b: RGB) => {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return dr * dr + dg * dg + db * db
}

const findNearestColor = (color: RGB, palette: RGB[]) => {
  let best = palette[0]
  let bestDist = Number.POSITIVE_INFINITY
  for (const p of palette) {
    const dist = colorDistance(color, p)
    if (dist < bestDist) {
      bestDist = dist
      best = p
    }
  }
  return best
}

const buildPalette = (pixels: Uint8ClampedArray, paletteSize: number): RGB[] => {
  const totalPixels = pixels.length / 4
  const maxSamples = 25000
  const step = Math.max(1, Math.floor(totalPixels / maxSamples))
  const samples: RGB[] = []

  for (let i = 0; i < totalPixels; i += step) {
    const idx = i * 4
    if (pixels[idx + 3] < 24) continue
    samples.push([pixels[idx], pixels[idx + 1], pixels[idx + 2]])
  }

  if (samples.length === 0) {
    return [[0, 0, 0]]
  }

  const target = clamp(paletteSize, 2, 64)
  const centroids: RGB[] = []
  for (let i = 0; i < target; i++) {
    centroids.push(samples[Math.floor((i / target) * samples.length)])
  }

  const iterations = 8
  for (let iter = 0; iter < iterations; iter++) {
    const sums = new Array(target).fill(0).map(() => [0, 0, 0, 0])

    for (const color of samples) {
      let best = 0
      let bestDist = Number.POSITIVE_INFINITY
      for (let c = 0; c < centroids.length; c++) {
        const dist = colorDistance(color, centroids[c])
        if (dist < bestDist) {
          best = c
          bestDist = dist
        }
      }

      sums[best][0] += color[0]
      sums[best][1] += color[1]
      sums[best][2] += color[2]
      sums[best][3] += 1
    }

    for (let c = 0; c < target; c++) {
      if (sums[c][3] === 0) {
        centroids[c] = samples[Math.floor(Math.random() * samples.length)]
        continue
      }
      centroids[c] = [
        Math.round(sums[c][0] / sums[c][3]),
        Math.round(sums[c][1] / sums[c][3]),
        Math.round(sums[c][2] / sums[c][3]),
      ]
    }
  }

  return centroids
}

const drawRoundedBlock = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = clamp(radius, 0, Math.min(width, height) / 2)
  if (r <= 0) {
    ctx.fillRect(x, y, width, height)
    return
  }

  const roundable = ctx as CanvasRenderingContext2D & {
    roundRect?: (x: number, y: number, w: number, h: number, radii?: number | number[]) => void
  }
  if (typeof roundable.roundRect === 'function') {
    ctx.beginPath()
    roundable.roundRect(x, y, width, height, r)
    ctx.fill()
    return
  }

  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
  ctx.fill()
}

const canvasToPngBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create image blob'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })

export const generateMosaicImage = async ({
  sourceImage,
  targetWidth,
  targetHeight,
  blockSize,
  cornerRadius,
  paletteSize,
}: GenerateMosaicOptions): Promise<GenerateMosaicResult> => {
  const width = clamp(Math.round(targetWidth), 80, 3000)
  const height = clamp(Math.round(targetHeight), 80, 3000)
  const block = clamp(Math.round(blockSize), 2, 120)
  const corner = clamp(Math.round(cornerRadius), 0, block)

  const inputCanvas = document.createElement('canvas')
  inputCanvas.width = width
  inputCanvas.height = height
  const inputCtx = inputCanvas.getContext('2d')
  if (!inputCtx) {
    throw new Error('Canvas 2D context unavailable')
  }

  inputCtx.drawImage(sourceImage, 0, 0, width, height)
  const inputData = inputCtx.getImageData(0, 0, width, height)
  const palette = buildPalette(inputData.data, paletteSize)

  const outCanvas = document.createElement('canvas')
  outCanvas.width = width
  outCanvas.height = height
  const outCtx = outCanvas.getContext('2d')
  if (!outCtx) {
    throw new Error('Canvas 2D context unavailable')
  }

  outCtx.fillStyle = '#ffffff'
  outCtx.fillRect(0, 0, width, height)

  for (let by = 0; by < height; by += block) {
    for (let bx = 0; bx < width; bx += block) {
      const bw = Math.min(block, width - bx)
      const bh = Math.min(block, height - by)

      let sr = 0
      let sg = 0
      let sb = 0
      let count = 0

      for (let y = by; y < by + bh; y++) {
        const row = y * width
        for (let x = bx; x < bx + bw; x++) {
          const idx = (row + x) * 4
          sr += inputData.data[idx]
          sg += inputData.data[idx + 1]
          sb += inputData.data[idx + 2]
          count += 1
        }
      }

      const avg: RGB = [Math.round(sr / count), Math.round(sg / count), Math.round(sb / count)]
      const finalColor = findNearestColor(avg, palette)
      outCtx.fillStyle = `rgb(${finalColor[0]}, ${finalColor[1]}, ${finalColor[2]})`
      drawRoundedBlock(outCtx, bx, by, bw, bh, corner)
    }
  }

  return {
    blob: await canvasToPngBlob(outCanvas),
    palette,
  }
}
