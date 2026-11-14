// Two routes, no router library: "/" (the journey) and "/rover" (the rover explorer).
// Every move is a real history entry, so Back retraces the visitor's own path.
import { useEffect, useState } from 'react'

const NAV = 'app:navigate'

export function navigate(url: string) {
  history.pushState(null, '', url)
  window.dispatchEvent(new Event(NAV))
}

export const isRoverPath = (p: string) => /^\/rover\/?$/.test(p)

export function usePath() {
  const [path, setPath] = useState(location.pathname)
  useEffect(() => {
    const on = () => setPath(location.pathname)
    window.addEventListener('popstate', on)
    window.addEventListener(NAV, on)
    return () => { window.removeEventListener('popstate', on); window.removeEventListener(NAV, on) }
  }, [])
  return path
}
