import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Canvas from './pages/Canvas'
import BannerStudio from './pages/BannerStudio'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/:instanceId" element={<Canvas />} />
        <Route path="/:instanceId/studio" element={<BannerStudio />} />
      </Routes>
    </BrowserRouter>
  )
}
