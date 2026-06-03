import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Hide loader unconditionally after mount
function hideLoader() {
  const loader = document.getElementById('root-loading')
  if (loader) {
    loader.style.transition = 'opacity 0.3s ease'
    loader.style.opacity = '0'
    setTimeout(() => loader.remove(), 350)
  }
}

// Catch any crash and still remove the loader so we see the error
window.addEventListener('error', hideLoader)
window.addEventListener('unhandledrejection', hideLoader)

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)

// Hide loader after React has had time to render
setTimeout(hideLoader, 300)