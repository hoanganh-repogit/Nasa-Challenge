import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isAboutPath, isRoverPath, usePath } from './nav'

const RoverPage = lazy(() => import('./rover/RoverPage'))
const AboutPage = lazy(() => import('./about/AboutPage'))

function Root() {
  const path = usePath()
  if (isRoverPath(path)) return <Suspense fallback={null}><RoverPage /></Suspense>
  if (isAboutPath(path)) return <Suspense fallback={null}><AboutPage /></Suspense>
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
