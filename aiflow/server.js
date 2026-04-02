// AIFlow server — webhook receiver + API proxy + workflow persistence
// Run: node server.js

import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync } from 'fs'
import { randomUUID } from 'crypto'

// ── Load .env (no external dependency needed) ──────────────────────────────
try {
  const env = readFileSync('.env', 'utf8')
  for (const line of env.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const k = trimmed.slice(0, eq).trim()
    const v = trimmed.slice(eq + 1).trim()
    if (k && !process.env[k]) process.env[k] = v
  }
} catch { /* .env not required */ }

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.text())

// ── SSE for webhooks ────────────────────────────────────────────────────────
const sseClients = new Set()

app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()
  sseClients.add(res)
  req.on('close', () => sseClients.delete(res))
})

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`
  sseClients.forEach(res => res.write(msg))
}

app.all('/webhook/:path', (req, res) => {
  const path = req.params.path
  const payload = req.body
  console.log(`[webhook] ${req.method} /${path}`, payload)
  broadcast({ path, payload })
  res.json({ ok: true, path, received: payload })
})

// ── Helpers ─────────────────────────────────────────────────────────────────
async function signKlingJWT(accessKey, secretKey) {
  const encoder = new TextEncoder()
  const now = Math.floor(Date.now() / 1000)
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payloadB64 = Buffer.from(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 })).toString('base64url')
  const signingInput = `${headerB64}.${payloadB64}`
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(signingInput))
  return `${headerB64}.${payloadB64}.${Buffer.from(sig).toString('base64url')}`
}

// ── API Proxy: Gemini ────────────────────────────────────────────────────────
// POST /api/gemini  body: { model, action?, ...geminiBody }
app.post('/api/gemini', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-key']
    if (!apiKey) return res.status(400).json({ error: 'No Gemini API key. Set GEMINI_API_KEY in .env or add it in Settings.' })
    const { model, action = 'generateContent', ...body } = req.body
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${action}?key=${apiKey}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))
    res.status(response.status).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/gemini/operation?name=<operationName>  (Veo polling)
app.get('/api/gemini/operation', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || req.headers['x-gemini-key']
    if (!apiKey) return res.status(400).json({ error: 'No Gemini API key.' })
    const { name } = req.query
    const url = `https://generativelanguage.googleapis.com/v1beta/${name}?key=${apiKey}`
    const response = await fetch(url)
    const data = await response.json().catch(() => ({}))
    res.status(response.status).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── API Proxy: OpenAI ────────────────────────────────────────────────────────
app.post('/api/openai/chat', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY || req.headers['x-openai-key']
    if (!apiKey) return res.status(400).json({ error: 'No OpenAI API key. Set OPENAI_API_KEY in .env or add it in Settings.' })
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(req.body),
    })
    const data = await response.json().catch(() => ({}))
    res.status(response.status).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/openai/images', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY || req.headers['x-openai-key']
    if (!apiKey) return res.status(400).json({ error: 'No OpenAI API key.' })
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(req.body),
    })
    const data = await response.json().catch(() => ({}))
    res.status(response.status).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// OpenAI image edits — accepts JSON with base64 images[], server builds FormData
app.post('/api/openai/images/edits', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY || req.headers['x-openai-key']
    if (!apiKey) return res.status(400).json({ error: 'No OpenAI API key.' })
    const { prompt, size, quality, images } = req.body
    const formData = new FormData()
    formData.append('model', 'gpt-image-1')
    formData.append('prompt', prompt)
    formData.append('n', '1')
    formData.append('size', size || '1024x1024')
    formData.append('quality', quality || 'high')
    formData.append('output_format', 'b64_json')
    for (let i = 0; i < images.length; i++) {
      const [header, b64] = images[i].split(',')
      const mimeType = header.replace('data:', '').replace(';base64', '')
      const bytes = Buffer.from(b64, 'base64')
      formData.append('image[]', new Blob([bytes], { type: mimeType }), `ref_${i}.png`)
    }
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })
    const data = await response.json().catch(() => ({}))
    res.status(response.status).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── API Proxy: Kling (JWT signed server-side) ────────────────────────────────
app.post('/api/kling/task', async (req, res) => {
  try {
    const accessKey = process.env.KLING_ACCESS_KEY || req.headers['x-kling-key']
    const secretKey = process.env.KLING_SECRET_KEY || req.headers['x-kling-secret']
    if (!accessKey || !secretKey) return res.status(400).json({ error: 'No Kling API keys. Set KLING_ACCESS_KEY/KLING_SECRET_KEY in .env or add them in Settings.' })
    const { type = 'text2video', ...body } = req.body
    const endpoint = type === 'image2video'
      ? 'https://api.klingai.com/v1/videos/image2video'
      : 'https://api.klingai.com/v1/videos/text2video'
    const jwt = await signKlingJWT(accessKey, secretKey)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))
    res.status(response.status).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get('/api/kling/task/:id', async (req, res) => {
  try {
    const accessKey = process.env.KLING_ACCESS_KEY || req.headers['x-kling-key']
    const secretKey = process.env.KLING_SECRET_KEY || req.headers['x-kling-secret']
    if (!accessKey || !secretKey) return res.status(400).json({ error: 'No Kling API keys.' })
    const jwt = await signKlingJWT(accessKey, secretKey)
    const response = await fetch(`https://api.klingai.com/v1/videos/text2video/${req.params.id}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    const data = await response.json().catch(() => ({}))
    res.status(response.status).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── API Proxy: fal.ai (with image URL→base64 conversion) ────────────────────
// POST /api/fal  body: { modelId, referenceImages?: string[], ...falBody }
app.post('/api/fal', async (req, res) => {
  try {
    const apiKey = process.env.FAL_API_KEY || req.headers['x-fal-key']
    if (!apiKey) return res.status(400).json({ error: 'No fal.ai API key. Set FAL_API_KEY in .env or add it in Settings.' })
    const { modelId, referenceImages, ...body } = req.body
    // Convert reference image URLs to base64 to support multiple images and avoid CORS
    if (referenceImages && referenceImages.length > 0) {
      const converted = await Promise.all(referenceImages.map(async (imgUrl) => {
        if (imgUrl.startsWith('data:')) return imgUrl
        try {
          const imgRes = await fetch(imgUrl)
          const buffer = await imgRes.arrayBuffer()
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
          return `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`
        } catch { return imgUrl }
      }))
      if (converted.length > 0) body.image_url = converted[0]
      if (converted.length > 1) body.image_urls = converted
    }
    const response = await fetch(`https://fal.run/${modelId}`, {
      method: 'POST',
      headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({}))
    res.status(response.status).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ── Workflow Persistence ─────────────────────────────────────────────────────
const DB_FILE = './workflows.db.json'

function loadDb() {
  try { return JSON.parse(readFileSync(DB_FILE, 'utf8')) } catch { return { workflows: [] } }
}

function saveDb(db) {
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
}

app.get('/workflows', (req, res) => {
  const db = loadDb()
  res.json(db.workflows.map(w => ({ id: w.id, name: w.name, updatedAt: w.updatedAt, nodeCount: w.nodes?.length ?? 0 })))
})

app.get('/workflows/:id', (req, res) => {
  const db = loadDb()
  const w = db.workflows.find(w => w.id === req.params.id)
  if (!w) return res.status(404).json({ error: 'Not found' })
  res.json(w)
})

app.post('/workflows', (req, res) => {
  const db = loadDb()
  const workflow = { id: randomUUID(), ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  db.workflows.push(workflow)
  saveDb(db)
  res.json(workflow)
})

app.put('/workflows/:id', (req, res) => {
  const db = loadDb()
  const idx = db.workflows.findIndex(w => w.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  db.workflows[idx] = { ...db.workflows[idx], ...req.body, updatedAt: new Date().toISOString() }
  saveDb(db)
  res.json(db.workflows[idx])
})

app.delete('/workflows/:id', (req, res) => {
  const db = loadDb()
  const idx = db.workflows.findIndex(w => w.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  db.workflows.splice(idx, 1)
  saveDb(db)
  res.json({ ok: true })
})

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(3001, () => {
  console.log('AIFlow server running at http://localhost:3001')
  console.log('  Webhooks:  http://localhost:3001/webhook/<path>')
  console.log('  SSE:       http://localhost:3001/sse')
  console.log('  API proxy: http://localhost:3001/api/{gemini,openai,kling,fal}')
  console.log('  Workflows: http://localhost:3001/workflows')
  const hasKeys = !!(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.FAL_API_KEY)
  if (hasKeys) console.log('  ✓ API keys loaded from .env')
  else console.log('  ℹ No .env keys found — will use keys from client Settings panel')
})
