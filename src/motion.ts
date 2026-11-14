// Reduced motion: the system setting, unless the visitor chose otherwise with the on-screen toggle.
import { useEffect, useState } from 'react'

const KEY = 'eoc-motion' // 'reduce' | 'full'
const EVT = 'eoc-motion'
const query = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null)

// ?motion=on / ?motion=off in the URL sets the choice (handy when a remembered setting surprises someone)
try {
  const q = new URLSearchParams(location.search).get('motion')
  if (q === 'on') localStorage.setItem(KEY, 'full')
  if (q === 'off') localStorage.setItem(KEY, 'reduce')
} catch { /* storage blocked */ }

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
