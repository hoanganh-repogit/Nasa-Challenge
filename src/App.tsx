import { useEffect, useRef, useState } from 'react'
import './App.css'
import { StageController } from './stage/controller'
import type { Quality } from './stage/director'
import { loadStageAssets } from './stage/load'

const params = new URLSearchParams(location.search)
const DEBUG = params.has('debug')

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctrlRef = useRef<StageController | null>(null)
  const fpsRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const q = (params.get('tier') as Quality) || 'mid'
    loadStageAssets().then((assets) => {
      if (disposed || !canvasRef.current) return
      const ctrl = new StageController(canvasRef.current, assets, {
        reducedMotion: reduced, quality: q,
        onFrame: () => {
          if (fpsRef.current) fpsRef.current.textContent = `${ctrl.fpsValue.toFixed(0)} fps · ${ctrl.stage.quality}`
        },
      })
      ctrl.autoQuality = !params.has('tier')
      ctrlRef.current = ctrl
      const shot = params.get('shot')
      const cam = params.get('cam') // debug: az,el,dist,tx,tz,fov applied to the chosen shot
      if (cam) {
        const [az, el, dist, tx, tz, fov] = cam.split(',').map(Number)
        const s = shot === null || Number(shot) < 0 ? ctrl.shots.opening : ctrl.shots.stops[Number(shot)]
        Object.assign(s.pose, { az, el, dist, ...(Number.isFinite(tx) ? { tx, tz } : {}), ...(Number.isFinite(fov) ? { fov } : {}) })
      }
      if (shot !== null || cam) ctrl.goTo(shot === null ? -1 : Number(shot), true)
      ctrl.start()
      ;(window as unknown as { stage: StageController }).stage = ctrl
      setReady(true)
    }).catch((e: unknown) => setError(String(e)))
    const onResize = () => ctrlRef.current?.stage.resize()
    window.addEventListener('resize', onResize)
    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      ctrlRef.current?.dispose()
      ctrlRef.current = null
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="stage" aria-hidden="true" data-ready={ready} />
      {error && <p role="alert" className="stage-error">The 3D stage could not load: {error}</p>}
      {DEBUG && <div ref={fpsRef} className="fps" />}
    </>
  )
}
