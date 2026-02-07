import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { GtdProvider } from './context/GtdContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GtdProvider>
      <App />
    </GtdProvider>
  </React.StrictMode>,
)