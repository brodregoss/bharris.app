import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import { rewriteFirebaseResetUrl } from '@/lib/authAction'
import '@/index.css'

rewriteFirebaseResetUrl()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
