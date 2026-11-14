import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { isRoverPath, usePath } from './nav'

const RoverPage = lazy(() => import('./rover/RoverPage'))

function Root() {
  const path = usePath()
  if (isRoverPath(path)) return <Suspense fallback={null}><RoverPage /></Suspense>
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
