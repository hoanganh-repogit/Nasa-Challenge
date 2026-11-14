// Reduced motion: the system setting, unless the visitor chose otherwise with the on-screen toggle.
import { useEffect, useState } from 'react'

const KEY = 'eoc-motion' // 'reduce' | 'full'
const EVT = 'eoc-motion'
const query = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null)

export function reducedMotionNow(): boolean {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'reduce') return true
    if (v === 'full') return false
  } catch { /* storage blocked: fall back to the system setting */ }
  return !!query()?.matches
}

export function setReducedMotion(reduce: boolean) {
  try { localStorage.setItem(KEY, reduce ? 'reduce' : 'full') } catch { /* keeps working for this page only */ }
  window.dispatchEvent(new Event(EVT))
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(reducedMotionNow)
  useEffect(() => {
    const on = () => setReduced(reducedMotionNow())
    const mq = query()
    window.addEventListener(EVT, on)
    mq?.addEventListener('change', on)
    return () => { window.removeEventListener(EVT, on); mq?.removeEventListener('change', on) }
  }, [])
  useEffect(() => { document.documentElement.dataset.motion = reduced ? 'reduce' : 'full' }, [reduced])
  return reduced
}
