import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isAboutPath, isFilmPath, isRoverPath, usePath } from './nav'

const RoverPage = lazy(() => import('./rover/RoverPage'))
const AboutPage = lazy(() => import('./about/AboutPage'))
const FilmPage = lazy(() => import('./film/FilmPage'))

function Root() {
  const path = usePath()
  if (isRoverPath(path)) return <Suspense fallback={null}><RoverPage /></Suspense>
  if (isAboutPath(path)) return <Suspense fallback={null}><AboutPage /></Suspense>
  if (isFilmPath(path)) return <Suspense fallback={null}><FilmPage /></Suspense>
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
