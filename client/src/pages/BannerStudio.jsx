import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const API = ''

const DEFAULT_PROMPT = `You are a senior art director redesigning a piece of key art for a {{RATIO}} banner ({{ART_WIDTH}}×{{ART_HEIGHT}} px).

=== SAFE ZONES ===
The final banner will have a frame overlaid on top. These areas will be PARTIALLY COVERED:
{{LAYOUT}}
Only put expendable background in those zones — skies, gradients, blurred texture. All important content (faces, titles, logos, characters) MUST be inside the safe area that remains visible.

=== YOUR JOB ===
You are RECOMPOSING the artwork for a new shape, the way a designer would create an alternate campaign layout. You are NOT resizing or cropping.

1. READ every piece of text in the source art — titles, taglines, dates, credits, logos. Note the EXACT spelling, capitalisation, font style, weight, colour, and visual treatment (shadows, outlines, gradients, effects).

2. REDESIGN the layout for {{RATIO}}:
   - The hero subject must be COMPLETE — full head, full body if shown, no awkward crops.
   - If the original title fits on one line but the new shape is too narrow or too short, REFLOW the text: split across two lines, stack it vertically, move it to a different area — whatever a designer would do. You may resize the title, reposition it, split it across top and bottom, or center it with effects that match the artwork's mood.
   - Use the SAME font style, the SAME colour, the SAME visual effects. If the title had a metallic gradient and drop shadow, the reflowed title must also have a metallic gradient and drop shadow.
   - Place characters, title, and key elements in the SAFE ZONE where they will NOT be covered by the banner frame.
   - Fill the overlay zones with atmospheric extension: continue the sky, fog, sparks, rain, environmental texture from the original.

3. SACRED RULES — things you must NEVER change:
   - The SPELLING of every word. If it says "Lord of the Rings" you output "Lord of the Rings" — letter for letter, no rewording.
   - The VISUAL IDENTITY — same art style (photorealistic stays photorealistic, illustrated stays illustrated), same colour palette, same lighting mood, same contrast.
   - The CONTENT — never add characters, objects, or text that are not part of the core artwork. Never remove characters or key artwork elements.

4. PLATFORM BRANDING — IGNORE AND STRIP:
   The source image may contain platform/streaming-service branding that is NOT part of the artwork. You MUST identify and EXCLUDE all of the following:
   - Streaming service logos (e.g. Prime Video, Netflix, Disney+, HBO, Hulu, Apple TV+, Peacock, Paramount+, etc.)
   - Colored borders, frames, or background panels added by the platform (e.g. solid blue, red, or black borders around the key art)
   - Network bugs, channel logos, or broadcaster watermarks
   - "Watch now", "Stream on", "Only on", "Exclusive" platform badges
   - QR codes, URLs, or app store badges
   These are DISTRIBUTION PACKAGING, not artwork. Strip them out completely. Your output must contain ONLY the show/movie key art — the characters, title treatment, tagline, and atmospheric background. Do NOT reproduce any platform branding, colored borders, or service logos.

5. ABSOLUTE RULES:
   - NEVER change, rephrase, abbreviate, or misspell ANY text from the original artwork (titles, taglines, dates — NOT platform branding text).
   - NEVER stretch, squash, or distort any element.
   - NEVER add borders, letterboxing, or pillarboxing.
   - NEVER leave dead space — fill the full {{RATIO}} canvas.
   - NEVER crop the hero subject's face or head.
   - NEVER place important content in the overlay zones described above — it WILL be covered.
   - NEVER reproduce dimension lines, measurement annotations, pixel counts, ruler marks, grid overlays, bounding boxes, or any technical markup that may appear in the source image. These are NOT part of the artwork — they are editing artifacts. Ignore them completely and produce clean artwork only.
   - NEVER reproduce platform branding, streaming service logos, or colored platform borders from the source image. These will be added separately by the banner template system.`

const MODELS = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2', desc: 'Fast' },
  { id: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro', desc: 'High fidelity' },
]

export default function BannerStudio() {
  const navigate = useNavigate()
  const [banners, setBanners] = useState([])
  const [selected, setSelected] = useState([])
  const [artFile, setArtFile] = useState(null)
  const [artPreview, setArtPreview] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState([])
  const [results, setResults] = useState([])
  const [viewTab, setViewTab] = useState('banners')
  const [dragOver, setDragOver] = useState(false)
  const [model, setModel] = useState('gemini-3.1-flash-image-preview')
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [showSettings, setShowSettings] = useState(false)
  const [uploadingTemplate, setUploadingTemplate] = useState(null)
  const [selectedResult, setSelectedResult] = useState(null)
  const [addingFormat, setAddingFormat] = useState(false)
  const [newFormatName, setNewFormatName] = useState('')
  const [bannerNotes, setBannerNotes] = useState({})
  const [notesOpen, setNotesOpen] = useState({})
  const fileRef = useRef()
  const newFormatRef = useRef()
  const templateRefs = useRef({})
  const resultsRef = useRef()

  const loadBanners = () => {
    fetch(`${API}/api/banners`).then(r => r.json()).then(data => {
      setBanners(data)
      setSelected(prev => prev.length ? prev : data.map(b => b.id))
    })
  }

  useEffect(() => { loadBanners() }, [])

  const uploadTemplate = async (bannerId, file) => {
    setUploadingTemplate(bannerId)
    const form = new FormData()
    form.append('template', file)
    try {
      const res = await fetch(`${API}/api/templates/${bannerId}/upload`, { method: 'POST', body: form })
      const data = await res.json()
      if (data.success) loadBanners()
      else alert(data.error || 'Upload failed')
    } catch (e) { alert('Upload failed: ' + e.message) }
    setUploadingTemplate(null)
  }

  const revertTemplate = async (bannerId) => {
    await fetch(`${API}/api/templates/${bannerId}/custom`, { method: 'DELETE' })
    loadBanners()
  }

  const addFormat = async (file) => {
    if (!file || !newFormatName.trim()) return
    setAddingFormat(true)
    const form = new FormData()
    form.append('frame', file)
    form.append('label', newFormatName.trim())
    try {
      const res = await fetch(`${API}/api/formats/new`, { method: 'POST', body: form })
      const data = await res.json()
      if (data.success) {
        loadBanners()
        setNewFormatName('')
        setSelected(prev => [...prev, data.id])
      } else {
        alert(data.error || 'Failed to add format')
      }
    } catch (e) { alert('Failed: ' + e.message) }
    setAddingFormat(false)
  }

  const deleteFormat = async (id) => {
    await fetch(`${API}/api/formats/${id}`, { method: 'DELETE' })
    setSelected(s => s.filter(x => x !== id))
    loadBanners()
  }

  const handleFile = (file) => {
    if (!file) return
    setArtFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setArtPreview(e.target.result)
    reader.readAsDataURL(file)
    setResults([])
    setProgress([])
    setSelectedResult(null)
  }

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  const generate = async () => {
    if (!artFile || !selected.length) return
    setGenerating(true)
    setResults([])
    setProgress([])
    setViewTab('banners')
    setSelectedResult(null)

    const form = new FormData()
    form.append('art', artFile)
    form.append('bannerIds', JSON.stringify(selected))
    form.append('model', model)
    form.append('customPrompt', prompt)
    form.append('bannerNotes', JSON.stringify(bannerNotes))

    try {
      const response = await fetch(`${API}/api/generate`, { method: 'POST', body: form })
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'progress') {
              setProgress(p => {
                const idx = p.findIndex(x => x.bannerId === data.bannerId)
                if (idx >= 0) { const u = [...p]; u[idx] = data; return u }
                return [...p, data]
              })
            } else if (data.type === 'complete') {
              setResults(r => [...r, data])
              setProgress(p => p.map(x => x.bannerId === data.bannerId ? { ...x, step: 'done' } : x))
            } else if (data.type === 'error') {
              setProgress(p => p.map(x => x.bannerId === data.bannerId ? { ...x, step: 'error', error: data.error } : x))
            }
          } catch {}
        }
      }
    } catch (err) { console.error(err) }
    setGenerating(false)
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 300)
  }

  const allSelected = selected.length === banners.length
  const completedCount = progress.filter(p => p.step === 'done').length
  const errorCount = progress.filter(p => p.step === 'error').length
  const canGenerate = artFile && selected.length && !generating

  return (
    <div className="app">
      {/* ===== HEADER ===== */}
      <header className="header">
        <div className="header-left">
          <div className="brand">
            <button className="back-btn" onClick={() => navigate('/')}>←</button>
            <div className="brand-mark">S</div>
            <div className="brand-text">
              <span className="brand-name">Stanley's Post</span>
              <span className="brand-divider">/</span>
              <span className="brand-sub">Banner Studio</span>
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="model-switch">
            {MODELS.map(m => (
              <button
                key={m.id}
                className={`model-opt ${model === m.id ? 'active' : ''}`}
                onClick={() => setModel(m.id)}
              >
                <span className="model-label">{m.label}</span>
                <span className="model-desc">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="main">
        <div className="workspace">
          {/* LEFT: Upload + Config */}
          <div className="sidebar">
            {/* Upload */}
            <div className="panel">
              <div className="panel-label">Input</div>
              <div
                className={`dropzone ${dragOver ? 'drag-over' : ''} ${artFile ? 'has-file' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
              >
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files[0])} />
                {artPreview ? (
                  <div className="upload-preview">
                    <img src={artPreview} className="upload-thumb" />
                    <div className="upload-info">
                      <div className="upload-name">{artFile.name}</div>
                      <div className="upload-meta">{(artFile.size / 1024 / 1024).toFixed(1)} MB</div>
                      <div className="upload-change">Replace</div>
                    </div>
                  </div>
                ) : (
                  <div className="upload-empty">
                    <div className="upload-arrow">↑</div>
                    <div className="upload-text">Drop key art here</div>
                    <div className="upload-formats">PNG, JPG, WebP</div>
                  </div>
                )}
              </div>
            </div>

            {/* Banner Formats */}
            <div className="panel">
              <div className="panel-header">
                <div className="panel-label">Formats</div>
                <button className="link-btn" onClick={() => setSelected(allSelected ? [] : banners.map(b => b.id))}>
                  {allSelected ? 'Clear' : 'All'}
                </button>
              </div>
              <div className="format-list">
                {banners.map(b => {
                  const hasNote = !!(bannerNotes[b.id]?.trim())
                  const isOpen = notesOpen[b.id]
                  return (
                    <div key={b.id} className={`format-row ${selected.includes(b.id) ? 'on' : ''}`}>
                      <div className="format-main" onClick={() => toggle(b.id)}>
                        <div className={`format-toggle ${selected.includes(b.id) ? 'on' : ''}`}>
                          <div className="format-toggle-dot" />
                        </div>
                        <div className="format-info">
                          <span className="format-name">{b.label}</span>
                          <span className="format-spec">{b.width}×{b.height}</span>
                          <span className="format-ratio">{b.ratio}</span>
                          {b.isUserCreated && <span className="tag-custom">Custom</span>}
                        </div>
                      </div>
                      <div className="format-actions">
                        <input type="file" accept="image/*,.svg" hidden ref={el => templateRefs.current[b.id] = el}
                          onChange={(e) => { if (e.target.files[0]) uploadTemplate(b.id, e.target.files[0]); e.target.value = '' }} />
                        <button className="ghost-btn" onClick={() => templateRefs.current[b.id]?.click()}>
                          {uploadingTemplate === b.id ? '···' : b.isCustom ? 'Replace' : 'Template'}
                        </button>
                        <button
                          className={`ghost-btn note-toggle ${hasNote ? 'has-note' : ''} ${isOpen ? 'active' : ''}`}
                          title="Banner-specific instructions"
                          onClick={() => setNotesOpen(o => ({ ...o, [b.id]: !o[b.id] }))}
                        >✎</button>
                        {b.isCustom && !b.isUserCreated && (
                          <>
                            <span className="tag-custom">Custom</span>
                            <button className="ghost-btn warn" onClick={() => revertTemplate(b.id)}>×</button>
                          </>
                        )}
                        {b.isUserCreated && (
                          <button className="ghost-btn warn" onClick={() => deleteFormat(b.id)}>×</button>
                        )}
                      </div>
                      {isOpen && (
                        <div className="banner-note-box">
                          <textarea
                            className="banner-note-input"
                            placeholder={`Extra instructions for ${b.label} only…`}
                            value={bannerNotes[b.id] || ''}
                            onChange={(e) => setBannerNotes(n => ({ ...n, [b.id]: e.target.value }))}
                            rows={3}
                            spellCheck={false}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Add New Format */}
                <div className="new-format-row">
                  <input
                    className="new-format-input"
                    type="text"
                    placeholder="Format name..."
                    value={newFormatName}
                    onChange={(e) => setNewFormatName(e.target.value)}
                  />
                  <input
                    type="file"
                    accept="image/*,.svg"
                    hidden
                    ref={newFormatRef}
                    onChange={(e) => {
                      if (e.target.files[0]) addFormat(e.target.files[0])
                      e.target.value = ''
                    }}
                  />
                  <button
                    className="new-format-btn"
                    disabled={!newFormatName.trim() || addingFormat}
                    onClick={() => newFormatRef.current?.click()}
                  >
                    {addingFormat ? '···' : '+ Add'}
                  </button>
                </div>
              </div>
            </div>

            {/* System Prompt */}
            <div className="panel">
              <div className="panel-header clickable" onClick={() => setShowSettings(!showSettings)}>
                <div className="panel-label">
                  Prompt
                  {prompt !== DEFAULT_PROMPT && <span className="tag-mod">Modified</span>}
                </div>
                <span className={`chevron ${showSettings ? 'open' : ''}`}>›</span>
              </div>
              {showSettings && (
                <div className="prompt-section">
                  <div className="prompt-hint">
                    Variables: <code>{'{{RATIO}}'}</code> <code>{'{{LAYOUT}}'}</code> <code>{'{{ART_WIDTH}}'}</code> <code>{'{{ART_HEIGHT}}'}</code>
                  </div>
                  <textarea
                    className="prompt-editor"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={12}
                    spellCheck={false}
                  />
                  <div className="prompt-footer">
                    <button className="link-btn" onClick={() => setPrompt(DEFAULT_PROMPT)}>Reset</button>
                    <span className="prompt-count">{prompt.length}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Generate */}
            <button
              className={`gen-btn ${!canGenerate ? 'off' : ''}`}
              disabled={!canGenerate}
              onClick={generate}
            >
              {generating ? (
                <span className="gen-inner">
                  <span className="gen-spinner" />
                  Processing {completedCount}/{selected.length}
                </span>
              ) : (
                <span className="gen-inner">
                  Generate {selected.length} format{selected.length !== 1 ? 's' : ''}
                  <span className="gen-arrow">→</span>
                </span>
              )}
            </button>
          </div>

          {/* RIGHT: Results */}
          <div className="canvas-area" ref={resultsRef}>
            {/* Progress */}
            {generating && progress.length > 0 && (
              <div className="progress-block">
                <div className="progress-top">
                  <span className="progress-title">Processing</span>
                  <span className="progress-frac">{completedCount}<span className="progress-of">/{progress.length}</span></span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${(completedCount / Math.max(progress.length, 1)) * 100}%` }} />
                </div>
                <div className="progress-pills">
                  {progress.map(p => (
                    <div key={p.bannerId} className={`pill ${p.step}`}>
                      <span className={`pill-dot ${p.step}`} />
                      <span className="pill-name">{p.label}</span>
                      <span className="pill-status">
                        {p.step === 'regenerating' && 'Gen'}
                        {p.step === 'compositing' && 'Comp'}
                        {p.step === 'done' && '✓'}
                        {p.step === 'error' && '✗'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results */}
            {results.length > 0 && (
              <>
                <div className="results-bar">
                  <div className="tab-group">
                    {[
                      { id: 'banners', label: 'Final' },
                      { id: 'regenerated', label: 'AI Art' },
                      { id: 'templates', label: 'Templates' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        className={`tab ${viewTab === tab.id ? 'active' : ''}`}
                        onClick={() => setViewTab(tab.id)}
                      >{tab.label}</button>
                    ))}
                  </div>
                  <span className="results-n">{results.length} outputs</span>
                </div>

                <div className="results-grid">
                  {results.map(r => (
                    <div
                      key={r.bannerId}
                      className="result-card"
                      onClick={() => setSelectedResult(selectedResult === r.bannerId ? null : r.bannerId)}
                    >
                      <div className="result-img-wrap">
                        <img
                          src={
                            viewTab === 'banners'      ? (r.bannerData   ? `data:image/png;base64,${r.bannerData}`   : r.bannerUrl)   :
                            viewTab === 'regenerated'  ? (r.regenData    ? `data:image/png;base64,${r.regenData}`    : r.regenUrl)    :
                                                         (r.templateData ? `data:image/png;base64,${r.templateData}` : r.templateUrl)
                          }
                          className="result-img"
                        />
                      </div>
                      <div className="result-footer">
                        <div className="result-info">
                          <span className="result-name">{r.label}</span>
                          <span className="result-dims">{r.width}×{r.height}</span>
                        </div>
                        <a
                          href={r.bannerData ? `data:image/png;base64,${r.bannerData}` : r.bannerUrl}
                          download={r.bannerData ? `${r.label.replace(/\s+/g,'-')}.png` : undefined}
                          target={r.bannerData ? undefined : "_blank"}
                          className="dl-btn"
                          onClick={e => e.stopPropagation()}
                        >↓</a>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Empty state */}
            {!generating && results.length === 0 && (
              <div className="empty">
                <div className="empty-graphic">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
                <div className="empty-text">Output canvas</div>
                <div className="empty-sub">Your generated banners will appear here across all selected formats</div>
                <div className="empty-steps">
                  <div className="empty-step"><span className="empty-step-num">1</span>Upload art</div>
                  <div className="empty-step"><span className="empty-step-num">2</span>Select formats</div>
                  <div className="empty-step"><span className="empty-step-num">3</span>Generate</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ===== LIGHTBOX ===== */}
      {selectedResult && (() => {
        const r = results.find(x => x.bannerId === selectedResult)
        if (!r) return null
        return (
          <div className="lightbox" onClick={() => setSelectedResult(null)}>
            <div className="lightbox-body" onClick={e => e.stopPropagation()}>
              <button className="lightbox-x" onClick={() => setSelectedResult(null)}>×</button>
              <img
                src={
                  viewTab === 'banners'      ? (r.bannerData   ? `data:image/png;base64,${r.bannerData}`   : r.bannerUrl)   :
                  viewTab === 'regenerated'  ? (r.regenData    ? `data:image/png;base64,${r.regenData}`    : r.regenUrl)    :
                                               (r.templateData ? `data:image/png;base64,${r.templateData}` : r.templateUrl)
                }
                className="lightbox-img"
              />
              <div className="lightbox-bar">
                <span className="lightbox-name">{r.label}</span>
                <span className="lightbox-dims">{r.width}×{r.height}</span>
                <a
                  href={r.bannerData ? `data:image/png;base64,${r.bannerData}` : r.bannerUrl}
                  download={r.bannerData ? `${r.label.replace(/\s+/g,'-')}.png` : undefined}
                  target={r.bannerData ? undefined : "_blank"}
                  className="dl-btn"
                >↓ Download</a>
              </div>
            </div>
          </div>
        )
      })()}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&family=Space+Mono:wght@400;700&display=swap');

        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
          --bg: #0b0b0e;
          --surface: #111116;
          --surface-2: #18181f;
          --surface-3: #1f1f28;
          --border: rgba(255,255,255,0.08);
          --border-hover: rgba(255,255,255,0.15);
          --text: #f0f0f5;
          --text-dim: #9090a0;
          --text-muted: #50505e;
          --accent: #ff6b2b;
          --accent-dim: rgba(255,107,43,0.14);
          --accent-hover: #ff7f45;
          --accent-glow: rgba(255,107,43,0.25);
          --green: #2de88a;
          --green-dim: rgba(45,232,138,0.12);
          --red: #ff4d6a;
          --red-dim: rgba(255,77,106,0.12);
          --blue: #4da6ff;
          --mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', monospace;
          --display: 'Space Grotesk', -apple-system, sans-serif;
          --radius: 6px;
        }

        .app {
          font-family: var(--mono);
          background: var(--bg);
          color: var(--text);
          height: 100vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          -webkit-font-smoothing: antialiased;
        }

        /* ===== HEADER ===== */
        .header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 20px; height: 52px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
          z-index: 100;
        }
        .header-left, .header-right { display: flex; align-items: center; }

        .back-btn {
          width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--border);
          background: transparent; color: var(--text-dim); font-size: 16px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.15s; font-family: var(--mono);
        }
        .back-btn:hover { color: var(--text); border-color: var(--border-hover); background: var(--surface-2); }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand-mark {
          width: 30px; height: 30px; border-radius: 5px;
          background: var(--accent);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--display); font-weight: 700; font-size: 15px; color: #fff;
          box-shadow: 0 0 16px var(--accent-glow);
        }
        .brand-text { display: flex; align-items: baseline; gap: 8px; font-size: 13px; }
        .brand-name { font-family: var(--display); font-weight: 600; color: #fff; letter-spacing: -0.3px; }
        .brand-divider { color: var(--text-muted); font-weight: 300; }
        .brand-sub { color: var(--text-dim); font-weight: 400; font-size: 12px; }

        .model-switch {
          display: flex; border: 1px solid var(--border); border-radius: var(--radius);
          overflow: hidden;
        }
        .model-opt {
          display: flex; flex-direction: column; align-items: flex-start;
          padding: 7px 18px; border: none; border-right: 1px solid var(--border);
          background: transparent; cursor: pointer; transition: all 0.15s;
          min-width: 138px;
        }
        .model-opt:last-child { border-right: none; }
        .model-opt .model-label {
          font-family: var(--mono); font-size: 11px; font-weight: 500;
          color: var(--text-dim); letter-spacing: 0.3px; transition: color 0.15s;
        }
        .model-opt .model-desc {
          font-family: var(--mono); font-size: 9px; color: var(--text-muted);
          margin-top: 1px; transition: color 0.15s;
        }
        .model-opt.active { background: var(--surface-2); }
        .model-opt.active .model-label { color: var(--accent); }
        .model-opt.active .model-desc { color: var(--text-dim); }
        .model-opt:hover:not(.active) .model-label { color: var(--text); }

        /* ===== MAIN LAYOUT ===== */
        .main {
          flex: 1; overflow: hidden;
          padding: 16px 20px;
          display: flex; flex-direction: column;
        }
        .workspace {
          display: grid;
          grid-template-columns: 340px 1fr;
          gap: 14px;
          flex: 1;
          min-height: 0;
        }

        /* ===== SIDEBAR ===== */
        .sidebar {
          display: flex; flex-direction: column; gap: 10px;
          overflow-y: auto; min-height: 0;
          padding-right: 2px;
        }
        .sidebar::-webkit-scrollbar { width: 3px; }
        .sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 99px; }

        .panel {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 8px; padding: 14px;
          transition: border-color 0.15s; flex-shrink: 0;
        }
        .panel:hover { border-color: var(--border-hover); }
        .panel-label {
          font-family: var(--mono); font-size: 10px; font-weight: 500;
          color: var(--text-dim); text-transform: uppercase; letter-spacing: 1.5px;
          margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
        }
        .panel-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 12px;
        }
        .panel-header .panel-label { margin-bottom: 0; }
        .panel-header.clickable { cursor: pointer; margin-bottom: 0; }
        .panel-header.clickable:hover .panel-label { color: var(--text); }

        .link-btn {
          background: none; border: none; font-family: var(--mono);
          font-size: 10px; color: var(--accent); cursor: pointer;
          letter-spacing: 0.5px; text-transform: uppercase; font-weight: 600;
          transition: color 0.15s; padding: 0;
        }
        .link-btn:hover { color: var(--accent-hover); text-decoration: underline; }

        .chevron {
          font-size: 18px; color: var(--text-dim); font-weight: 300;
          transition: transform 0.2s; display: inline-block;
        }
        .chevron.open { transform: rotate(90deg); }

        /* ===== DROPZONE ===== */
        .dropzone {
          border: 1px dashed rgba(255,255,255,0.12); border-radius: 6px;
          padding: 22px 16px; text-align: center; cursor: pointer;
          transition: all 0.2s;
        }
        .dropzone:hover { border-color: var(--accent); background: var(--accent-dim); }
        .dropzone.drag-over { border-color: var(--accent); background: rgba(255,107,43,0.1); box-shadow: 0 0 0 3px var(--accent-glow); }
        .dropzone.has-file { border-style: solid; border-color: var(--border); padding: 10px; }
        .dropzone.has-file:hover { border-color: var(--border-hover); background: transparent; }

        .upload-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .upload-arrow {
          font-size: 22px; color: var(--accent); font-weight: 300;
          width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
          border: 1px solid var(--accent-dim); border-radius: var(--radius); margin-bottom: 4px;
          background: var(--accent-dim);
        }
        .upload-text { font-size: 13px; color: var(--text); font-weight: 500; }
        .upload-formats { font-size: 10px; color: var(--text-muted); }

        .upload-preview { display: flex; align-items: center; gap: 12px; }
        .upload-thumb {
          width: 60px; height: 60px; border-radius: 5px; object-fit: cover;
          border: 1px solid var(--border);
        }
        .upload-name { font-size: 12px; font-weight: 600; color: var(--text); }
        .upload-meta { font-size: 10px; color: var(--text-dim); margin-top: 2px; }
        .upload-change { font-size: 10px; color: var(--accent); margin-top: 4px; cursor: pointer; font-weight: 500; }

        /* ===== FORMAT LIST ===== */
        .format-list {
          display: flex; flex-direction: column; gap: 1px;
        }
        .format-row {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; padding: 8px 8px; border-radius: 4px;
          transition: background 0.12s; border: 1px solid transparent;
        }
        .format-row:hover { background: rgba(255,255,255,0.03); }
        .format-row.on { background: var(--accent-dim); border-color: rgba(255,107,43,0.15); }
        .format-main { display: flex; align-items: center; gap: 10px; cursor: pointer; flex: 1; }

        .format-toggle {
          width: 24px; height: 13px; border-radius: 7px;
          background: var(--surface-3); border: 1px solid rgba(255,255,255,0.12);
          position: relative; transition: all 0.2s; flex-shrink: 0;
        }
        .format-toggle.on { background: var(--accent); border-color: var(--accent); box-shadow: 0 0 8px var(--accent-glow); }
        .format-toggle-dot {
          width: 9px; height: 9px; border-radius: 50%;
          background: var(--text-dim); position: absolute; top: 1px; left: 1px;
          transition: all 0.2s;
        }
        .format-toggle.on .format-toggle-dot { background: #fff; left: 12px; }

        .format-info { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; }
        .format-name { font-size: 11px; font-weight: 500; color: var(--text); }
        .format-spec { font-size: 10px; color: var(--text-dim); font-variant-numeric: tabular-nums; }
        .format-ratio { font-size: 9px; color: var(--text-muted); }

        .format-actions { display: flex; align-items: center; gap: 4px; }
        .ghost-btn {
          padding: 3px 8px; border-radius: 3px;
          border: 1px solid var(--border); background: transparent;
          color: var(--text-dim); font-family: var(--mono); font-size: 9px;
          cursor: pointer; transition: all 0.15s; letter-spacing: 0.3px;
        }
        .ghost-btn:hover { color: var(--text); border-color: var(--border-hover); background: var(--surface-2); }
        .ghost-btn.warn { color: var(--red); border-color: rgba(255,77,106,0.25); }
        .ghost-btn.warn:hover { background: var(--red-dim); }
        .ghost-btn.note-toggle { font-size: 11px; padding: 2px 7px; }
        .ghost-btn.note-toggle.has-note { color: var(--accent); border-color: rgba(255,107,43,0.35); }
        .ghost-btn.note-toggle.active { background: var(--accent-dim); color: var(--accent); border-color: rgba(255,107,43,0.35); }

        .banner-note-box {
          width: 100%; padding: 6px 10px 8px; border-top: 1px solid var(--border);
        }
        .banner-note-input {
          width: 100%; resize: vertical; padding: 6px 8px; border-radius: 4px;
          border: 1px solid var(--border); background: var(--bg);
          color: var(--text-dim); font-family: var(--mono); font-size: 10px; line-height: 1.5;
          outline: none; transition: border-color 0.15s; box-sizing: border-box;
        }
        .banner-note-input:focus { border-color: rgba(255,107,43,0.3); color: var(--text); }
        .banner-note-input::placeholder { color: var(--text-muted); font-style: italic; }

        .tag-custom {
          font-size: 8px; color: var(--green); background: var(--green-dim);
          padding: 2px 6px; border-radius: 2px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.8px;
        }
        .tag-mod {
          font-size: 8px; color: var(--accent); background: var(--accent-dim);
          padding: 2px 6px; border-radius: 2px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.8px;
        }

        /* ===== NEW FORMAT ===== */
        .new-format-row {
          display: flex; gap: 6px; margin-top: 8px; padding-top: 8px;
          border-top: 1px solid var(--border);
        }
        .new-format-input {
          flex: 1; padding: 6px 10px; border-radius: 4px;
          border: 1px solid var(--border); background: var(--bg);
          color: var(--text); font-family: var(--mono); font-size: 10px;
          outline: none; transition: border-color 0.15s;
        }
        .new-format-input:focus { border-color: rgba(255,107,43,0.3); }
        .new-format-input::placeholder { color: var(--text-muted); }
        .new-format-btn {
          padding: 6px 14px; border-radius: 4px; border: 1px solid var(--accent);
          background: var(--accent-dim); color: var(--accent); font-family: var(--mono);
          font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.15s;
          white-space: nowrap;
        }
        .new-format-btn:hover:not(:disabled) { background: rgba(255,107,43,0.22); }
        .new-format-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        /* ===== PROMPT ===== */
        .prompt-section { margin-top: 12px; animation: fadeIn 0.15s ease; }
        .prompt-hint {
          font-size: 10px; color: var(--text-dim); margin-bottom: 8px; line-height: 1.6;
        }
        .prompt-hint code {
          color: var(--accent); background: var(--accent-dim);
          padding: 1px 5px; border-radius: 2px; font-size: 9px; font-weight: 600;
        }
        .prompt-editor {
          width: 100%; background: var(--bg); border: 1px solid var(--border);
          border-radius: 4px; color: var(--text); padding: 12px;
          font-family: var(--mono); font-size: 10px; resize: vertical;
          outline: none; line-height: 1.8; transition: border-color 0.15s;
        }
        .prompt-editor:focus { border-color: rgba(255,107,43,0.3); box-shadow: 0 0 0 3px rgba(255,107,43,0.06); }
        .prompt-footer {
          display: flex; justify-content: space-between; align-items: center; margin-top: 6px;
        }
        .prompt-count { font-size: 9px; color: var(--text-dim); font-variant-numeric: tabular-nums; }

        /* ===== GENERATE BUTTON ===== */
        .gen-btn {
          width: 100%; padding: 14px; border-radius: 8px; border: none;
          background: var(--accent); color: #fff;
          font-family: var(--display); font-size: 13px; font-weight: 700;
          cursor: pointer; transition: all 0.2s; letter-spacing: -0.2px;
          box-shadow: 0 4px 20px var(--accent-glow);
          flex-shrink: 0;
          margin-top: auto;
        }
        .gen-btn:hover:not(.off) {
          background: var(--accent-hover);
          box-shadow: 0 6px 28px rgba(255,107,43,0.4);
          transform: translateY(-1px);
        }
        .gen-btn:active:not(.off) { transform: translateY(0); box-shadow: 0 2px 10px var(--accent-glow); }
        .gen-btn.off { opacity: 0.25; cursor: not-allowed; box-shadow: none; }
        .gen-inner { display: flex; align-items: center; justify-content: center; gap: 10px; }
        .gen-arrow { font-size: 16px; font-weight: 300; }

        .gen-spinner {
          width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite;
        }

        /* ===== CANVAS / RESULTS AREA ===== */
        .canvas-area {
          background: var(--surface-2);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px; padding: 24px;
          display: flex; flex-direction: column;
          min-height: 0; overflow-y: auto;
          background-image: radial-gradient(circle at 50% 50%, rgba(255,107,43,0.02) 0%, transparent 70%);
        }

        /* Progress */
        .progress-block { margin-bottom: 24px; animation: fadeIn 0.2s ease; }
        .progress-top {
          display: flex; justify-content: space-between; align-items: baseline;
          margin-bottom: 12px;
        }
        .progress-title {
          font-family: var(--mono); font-size: 10px; font-weight: 500;
          text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-dim);
        }
        .progress-frac {
          font-family: var(--display); font-size: 24px; font-weight: 700;
          color: var(--accent); letter-spacing: -1px;
        }
        .progress-of { color: var(--text-dim); font-weight: 300; font-size: 18px; }
        .progress-track {
          height: 3px; background: var(--surface-3); border-radius: 2px;
          margin-bottom: 14px; overflow: hidden;
        }
        .progress-fill {
          height: 100%; background: var(--accent); border-radius: 2px;
          transition: width 0.5s ease;
          box-shadow: 0 0 8px var(--accent-glow);
        }
        .progress-pills { display: flex; flex-wrap: wrap; gap: 6px; }
        .pill {
          display: flex; align-items: center; gap: 6px; padding: 5px 11px;
          background: var(--surface-2); border-radius: 4px; font-size: 10px;
          border: 1px solid var(--border);
        }
        .pill-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
        }
        .pill-dot.regenerating, .pill-dot.compositing { background: var(--accent); animation: pulse 1.2s infinite; box-shadow: 0 0 6px var(--accent-glow); }
        .pill-dot.done { background: var(--green); box-shadow: 0 0 6px rgba(45,232,138,0.4); }
        .pill-dot.error { background: var(--red); }
        .pill-name { color: var(--text); font-weight: 500; }
        .pill-status { color: var(--text-dim); }

        /* Tabs + Results header */
        .results-bar {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 18px;
        }
        .tab-group { display: flex; gap: 0; }
        .tab {
          padding: 7px 16px; border: 1px solid var(--border); border-right: none;
          background: transparent; color: var(--text-dim); font-family: var(--mono);
          font-size: 10px; font-weight: 500; cursor: pointer; transition: all 0.12s;
          letter-spacing: 0.3px;
        }
        .tab:first-child { border-radius: var(--radius) 0 0 var(--radius); }
        .tab:last-child { border-right: 1px solid var(--border); border-radius: 0 var(--radius) var(--radius) 0; }
        .tab.active { background: var(--surface-2); color: var(--accent); border-color: rgba(255,107,43,0.2); }
        .tab:hover:not(.active) { color: var(--text); background: rgba(255,255,255,0.02); }
        .results-n { font-size: 10px; color: var(--text-dim); }

        /* Results Grid */
        .results-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px; animation: fadeIn 0.3s ease;
        }
        .result-card {
          background: var(--bg); border: 1px solid var(--border);
          border-radius: var(--radius); overflow: hidden; cursor: pointer;
          transition: all 0.15s;
        }
        .result-card:hover { border-color: rgba(255,107,43,0.3); box-shadow: 0 0 20px rgba(255,107,43,0.06); }
        .result-img-wrap { padding: 10px; background: var(--bg); }
        .result-img {
          width: 100%; height: 170px; object-fit: contain; display: block;
          border-radius: 3px;
        }
        .result-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 12px; border-top: 1px solid var(--border);
        }
        .result-info { display: flex; flex-direction: column; }
        .result-name { font-size: 11px; font-weight: 600; color: var(--text); }
        .result-dims { font-size: 9px; color: var(--text-dim); margin-top: 2px; font-variant-numeric: tabular-nums; }

        .dl-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; border-radius: 4px; font-family: var(--mono);
          font-size: 10px; font-weight: 600; background: var(--accent-dim);
          color: var(--accent); text-decoration: none; transition: all 0.15s;
          border: 1px solid rgba(255,107,43,0.2);
        }
        .dl-btn:hover { background: rgba(255,107,43,0.22); border-color: rgba(255,107,43,0.4); }

        /* Empty state */
        .empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; text-align: center; gap: 14px;
        }
        .empty-graphic {
          width: 72px; height: 72px; border-radius: 16px;
          background: var(--surface-2); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-dim); opacity: 0.5;
        }
        .empty-text {
          font-family: var(--display); font-size: 20px; font-weight: 600;
          color: var(--text-dim); letter-spacing: -0.5px;
        }
        .empty-sub {
          font-size: 12px; color: var(--text-muted); line-height: 1.6;
          max-width: 260px;
        }
        .empty-steps {
          display: flex; gap: 8px; margin-top: 4px;
        }
        .empty-step {
          display: flex; align-items: center; gap: 6px;
          font-size: 10px; color: var(--text-muted);
          background: var(--surface-2); border: 1px solid var(--border);
          padding: 5px 10px; border-radius: 20px;
        }
        .empty-step-num {
          width: 16px; height: 16px; border-radius: 50%;
          background: var(--surface-3); color: var(--text-dim);
          display: flex; align-items: center; justify-content: center;
          font-size: 9px; font-weight: 700; flex-shrink: 0;
        }

        /* ===== LIGHTBOX ===== */
        .lightbox {
          position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.92);
          display: flex; align-items: center; justify-content: center;
          animation: fadeIn 0.15s ease; padding: 40px;
          backdrop-filter: blur(4px);
        }
        .lightbox-body {
          max-width: 90vw; max-height: 90vh; position: relative;
          display: flex; flex-direction: column; align-items: center; gap: 14px;
        }
        .lightbox-x {
          position: absolute; top: -36px; right: 0; background: none; border: none;
          color: var(--text-dim); cursor: pointer; font-size: 24px; font-weight: 300;
          font-family: var(--mono); transition: color 0.15s;
        }
        .lightbox-x:hover { color: var(--text); }
        .lightbox-img {
          max-width: 100%; max-height: 74vh; object-fit: contain; border-radius: 5px;
          border: 1px solid var(--border);
        }
        .lightbox-bar {
          display: flex; align-items: center; gap: 16px; font-size: 12px;
        }
        .lightbox-name { font-weight: 600; color: var(--text); }
        .lightbox-dims { color: var(--text-dim); font-variant-numeric: tabular-nums; }

        /* ===== ANIMATIONS ===== */
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 900px) {
          .workspace { grid-template-columns: 1fr; }
          .canvas-area { min-height: 300px; }
        }

        /* Focus */
        :focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }

        /* Selection */
        ::selection { background: rgba(255,107,43,0.25); color: var(--text); }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--surface-3); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
      `}</style>
    </div>
  )
}
