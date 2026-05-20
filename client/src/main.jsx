import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initializePowerUp } from './trello.js'

// Initialize Trello Power-Up
initializePowerUp();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)