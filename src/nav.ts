// Two routes, no router library: "/" (the journey) and "/rover" (the rover explorer).
// Moving between pages is a real history entry. Inside the journey the stops share one entry,
// so Back from any stop returns to the opening screen (or to the page the visitor came from).
import { useEffect, useState } from 'react'

const NAV = 'app:navigate'

export function navigate(url: string, state: unknown = null) {
  spaNavigated = true
  history.pushState(state, '', url)
  window.dispatchEvent(new Event(NAV))
}

/** false until the first in-app navigation: tells a fresh page load from a move inside the app */
export let spaNavigated = false

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
export const isAboutPath = (p: string) => /^\/about\/?$/.test(p)
export const isFilmPath = (p: string) => /^\/film\/?$/.test(p)
