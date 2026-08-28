import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { bootstrapNativeShell } from '@/lib/native'

bootstrapNativeShell()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
