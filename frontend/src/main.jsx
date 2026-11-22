import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { retiredSiteDestination } from './services/site.js'

const destination = retiredSiteDestination(window.location.href)

if (destination) {
  window.location.replace(destination)
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
