import { useEffect, useMemo, useRef, useState } from 'react'
import { generateMosaicImage, getSuggestedOutputSize, loadImage, type RGB } from './utils'

function App() {
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null)
  const [blockSize, setBlockSize] = useState(20)
  const [radius, setRadius] = useState(3)
  const [paletteSize, setPaletteSize] = useState(10)
  const [outputWidth, setOutputWidth] = useState(720)
  const [outputHeight, setOutputHeight] = useState(720)
  const [isGenerating, setIsGenerating] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [palette, setPalette] = useState<RGB[]>([])
  const [comparePosition, setComparePosition] = useState(50)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 组件卸载时清理 URL 对象
  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl)
      if (downloadUrl) URL.revokeObjectURL(downloadUrl)
    }
  }, [downloadUrl, sourceUrl])

  // 是否可以生成
  const canGenerate = useMemo(() => !!sourceImage && !isGenerating, [sourceImage, isGenerating])

  // 处理图片上传
  const onUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    const url = URL.createObjectURL(file)
    const image = await loadImage(url)
    setSourceUrl(url)
    setSourceImage(image)

    const suggested = getSuggestedOutputSize(image)
    setOutputWidth(suggested.width)
    setOutputHeight(suggested.height)
  }

  // 生成马赛克图像
  const generateMosaic = async () => {
    if (!sourceImage) return
    setIsGenerating(true)

    try {
      const { blob, palette: nextPalette } = await generateMosaicImage({
        sourceImage,
        targetWidth: outputWidth,
        targetHeight: outputHeight,
        blockSize,
        cornerRadius: radius,
        paletteSize,
      })

      if (downloadUrl) URL.revokeObjectURL(downloadUrl)
      const nextUrl = URL.createObjectURL(blob)
      setDownloadUrl(nextUrl)
      setPalette(nextPalette)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <div className="rounded-3xl bg-white/80 p-5 text-center sm:p-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-800">mosaic</h1>
      </div>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-xl backdrop-blur sm:p-4">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
          {sourceUrl ? (
            <img src={sourceUrl} alt="原图" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">请先上传图片</div>
          )}

          {downloadUrl && (
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 0 0 ${comparePosition}%)` }}
            >
              <img src={downloadUrl} alt="效果图" className="h-full w-full object-cover" />
            </div>
          )}

          <div
            className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-slate-900"
            style={{ left: `${comparePosition}%` }}
          />
          <div
            className="pointer-events-none absolute top-1/2 z-20 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-800 bg-white/95 shadow"
            style={{ left: `${comparePosition}%` }}
          />

          <input
            type="range"
            min={0}
            max={100}
            step={1}
            className="absolute inset-0 z-30 h-full w-full cursor-ew-resize opacity-0"
            value={comparePosition}
            onChange={(e) => setComparePosition(Number(e.target.value))}
            disabled={!sourceUrl || !downloadUrl}
          />

          <div className="pointer-events-none absolute bottom-4 left-5 rounded bg-white/70 px-2 py-1 text-sm font-semibold text-slate-700">
            原图
          </div>
          <div className="pointer-events-none absolute bottom-4 right-5 rounded bg-white/70 px-2 py-1 text-sm font-semibold text-slate-700">
            效果图
          </div>
        </div>
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onUpload}
      />

      <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          className="h-12 rounded-lg border border-slate-300 bg-white text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
          onClick={() => fileInputRef.current?.click()}
        >
          上传图片
        </button>
        <button
          className="h-12 rounded-lg bg-orange-900 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!canGenerate}
          onClick={generateMosaic}
        >
          {isGenerating ? (
            <><span className="loading loading-spinner loading-sm" />生成</>
          ) : '生成'}
        </button>
        {downloadUrl ? (
          <a
            className="flex h-12 items-center justify-center rounded-lg bg-teal-600 text-base font-semibold text-white shadow-sm transition hover:bg-teal-500"
            href={downloadUrl}
            download="mosaic.png"
          >
            下载
          </a>
        ) : (
          <button className="h-12 rounded-lg bg-slate-300 text-base font-semibold text-slate-500" disabled>
            下载
          </button>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-slate-400/60 bg-white/85 p-4 shadow-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-[90px,1fr,56px] items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">色块大小</span>
            <input
              type="range"
              min={2}
              max={120}
              step={1}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-slate-700"
              value={blockSize}
              onChange={(e) => setBlockSize(Number(e.target.value))}
            />
            <span className="text-right text-sm font-semibold text-slate-700">{blockSize}px</span>
          </div>

          <div className="grid grid-cols-[90px,1fr,56px] items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">色块圆角</span>
            <input
              type="range"
              min={0}
              max={40}
              step={1}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-slate-700"
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            />
            <span className="text-right text-sm font-semibold text-slate-700">{radius}px</span>
          </div>

          <div className="grid grid-cols-[90px,1fr] items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">输出尺寸</span>
            <div className="grid grid-cols-[1fr,24px,1fr] items-center gap-2">
              <input
                type="number"
                className="input input-bordered input-sm w-full px-2"
                value={outputWidth}
                min={80}
                max={3000}
                onChange={(e) => setOutputWidth(Number(e.target.value))}
              />
              <span className="text-center text-lg">x</span>
              <input
                type="number"
                className="input input-bordered input-sm w-full px-2"
                value={outputHeight}
                min={80}
                max={3000}
                onChange={(e) => setOutputHeight(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-[90px,1fr,56px] items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">颜色数</span>
            <input
              type="range"
              min={2}
              max={64}
              step={1}
              className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-slate-700"
              value={paletteSize}
              onChange={(e) => setPaletteSize(Number(e.target.value))}
            />
            <span className="text-right text-sm font-semibold text-slate-700">{paletteSize}</span>
          </div>

          <div className="rounded-lg bg-slate-100 p-3">
            <p className="mb-2 text-center text-sm font-semibold text-slate-700">调色板</p>
            {palette.length > 0 ? (
              <div className="grid grid-cols-8 gap-2 sm:grid-cols-10 md:grid-cols-12">
                {palette.map((color, idx) => (
                  <div
                    key={`${color.join('-')}-${idx}`}
                    className="h-7 rounded border border-slate-300"
                    style={{ backgroundColor: `rgb(${color[0]}, ${color[1]}, ${color[2]})` }}
                    title={`rgb(${color[0]}, ${color[1]}, ${color[2]})`}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-slate-400">生成后显示调色板</div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
