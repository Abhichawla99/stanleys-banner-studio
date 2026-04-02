import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
  const [variations, setVariations] = useState(1)
  const [favorites, setFavorites] = useState({})
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

  const totalJobs = selected.length * variations

  const toggleFavorite = (bannerId, jobId) => {
    setFavorites(f => f[bannerId] === jobId ? { ...f, [bannerId]: undefined } : { ...f, [bannerId]: jobId })
  }

  const downloadFavorites = () => {
    const favResults = results.filter(r => favorites[r.bannerId] === r.jobId)
    if (!favResults.length) return
    for (const r of favResults) {
      const a = document.createElement('a')
      a.href = r.bannerUrl
      a.download = `${r.label.replace(/\s+/g, '-')}${variations > 1 ? `-v${r.variationIndex + 1}` : ''}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  const groupedResults = useMemo(() => {
    const groups = {}
    for (const r of results) {
      if (!groups[r.bannerId]) groups[r.bannerId] = []
      groups[r.bannerId].push(r)
    }
    return Object.entries(groups)
  }, [results])

  const generate = async () => {
    if (!artFile || !selected.length) return
    setGenerating(true)
    setResults([])
    setProgress([])
    setFavorites({})
    setViewTab('banners')
    setSelectedResult(null)

    const form = new FormData()
    form.append('art', artFile)
    form.append('bannerIds', JSON.stringify(selected))
    form.append('model', model)
    form.append('customPrompt', prompt)
    form.append('bannerNotes', JSON.stringify(bannerNotes))
    form.append('variations', String(variations))

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
                const key = data.jobId || data.bannerId
                const idx = p.findIndex(x => (x.jobId || x.bannerId) === key)
                if (idx >= 0) { const u = [...p]; u[idx] = data; return u }
                return [...p, data]
              })
            } else if (data.type === 'complete') {
              setResults(r => [...r, data])
              setProgress(p => p.map(x => (x.jobId || x.bannerId) === (data.jobId || data.bannerId) ? { ...x, step: 'done' } : x))
            } else if (data.type === 'error') {
              setProgress(p => p.map(x => (x.jobId || x.bannerId) === (data.jobId || data.bannerId) ? { ...x, step: 'error', error: data.error } : x))
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
  const hasFavorites = Object.values(favorites).some(Boolean)

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

            {/* Variations */}
            <div className="panel">
              <div className="panel-label">Variations per format</div>
              <div className="variations-row">
                <input
                  type="range"
                  min={1} max={10}
                  value={variations}
                  onChange={(e) => setVariations(Number(e.target.value))}
                  className="variations-slider"
                />
                <span className="variations-count">{variations}</span>
              </div>
              <div className="variations-hint">
                {totalJobs} total image{totalJobs !== 1 ? 's' : ''} — {selected.length} format{selected.length !== 1 ? 's' : ''} × {variations} variation{variations !== 1 ? 's' : ''}
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
                  Processing {completedCount}/{totalJobs}
                </span>
              ) : (
                <span className="gen-inner">
                  Generate {totalJobs} image{totalJobs !== 1 ? 's' : ''}
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
                  <span className="progress-frac">{completedCount}<span className="progress-of">/{totalJobs}</span></span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${(completedCount / Math.max(totalJobs, 1)) * 100}%` }} />
                </div>
                <div className="progress-pills">
                  {progress.map(p => (
                    <div key={p.jobId || p.bannerId} className={`pill ${p.step}`}>
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
                  <div className="results-bar-right">
                    {variations > 1 && hasFavorites && (
                      <button className="dl-fav-btn" onClick={downloadFavorites}>
                        ↓ Favorites ({Object.values(favorites).filter(Boolean).length})
                      </button>
                    )}
                    <span className="results-n">{results.length} outputs</span>
                  </div>
                </div>

                <div className="results-grouped">
                  {groupedResults.map(([bannerId, vars]) => (
                    <div key={bannerId} className="format-group">
                      <div className="format-group-header">
                        <span className="format-group-name">{vars[0].label}</span>
                        <span className="format-group-dims">{vars[0].width}×{vars[0].height}</span>
                        {vars.length > 1 && <span className="format-group-count">{vars.length} variations</span>}
                      </div>
                      <div className={`variation-row ${vars.length === 1 ? 'single' : ''}`}>
                        {vars.map(r => {
                          const rKey = r.jobId || r.bannerId
                          const isFav = favorites[r.bannerId] === rKey
                          return (
                            <div
                              key={rKey}
                              className={`result-card ${isFav ? 'favorited' : ''}`}
                              onClick={() => setSelectedResult(selectedResult === rKey ? null : rKey)}
                            >
                              <div className="result-img-wrap">
                                <img
                                  src={
                                    viewTab === 'banners'      ? (r.bannerUrl)   :
                                    viewTab === 'regenerated'  ? (r.regenUrl)    :
                                                                 (r.templateUrl)
                                  }
                                  className="result-img"
                                />
                                {variations > 1 && (
                                  <div className="variation-badge">v{(r.variationIndex ?? 0) + 1}</div>
                                )}
                              </div>
                              <div className="result-footer">
                                <div className="result-info">
                                  <span className="result-name">{r.label}{variations > 1 ? ` v${(r.variationIndex ?? 0) + 1}` : ''}</span>
                                  <span className="result-dims">{r.width}×{r.height}</span>
                                </div>
                                <div className="result-actions">
                                  {variations > 1 && (
                                    <button
                                      className={`fav-btn ${isFav ? 'active' : ''}`}
                                      onClick={(e) => { e.stopPropagation(); toggleFavorite(r.bannerId, rKey) }}
                                      title={isFav ? 'Remove favorite' : 'Set as favorite'}
                                    >{isFav ? '★' : '☆'}</button>
                                  )}
                                  <a
                                    href={r.bannerUrl}
                                    target="_blank"
                                    className="dl-btn"
                                    onClick={e => e.stopPropagation()}
                                  >↓</a>
                                </div>
                              </div>
                            </div>
                          )
                        })}
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
        const r = results.find(x => (x.jobId || x.bannerId) === selectedResult)
        if (!r) return null
        const siblings = results.filter(x => x.bannerId === r.bannerId)
        const currentIdx = siblings.findIndex(x => (x.jobId || x.bannerId) === selectedResult)
        const hasPrev = currentIdx > 0
        const hasNext = currentIdx < siblings.length - 1
        const isFav = favorites[r.bannerId] === selectedResult
        return (
          <div className="lightbox" onClick={() => setSelectedResult(null)}>
            <div className="lightbox-body" onClick={e => e.stopPropagation()}>
              <button className="lightbox-x" onClick={() => setSelectedResult(null)}>×</button>
              {siblings.length > 1 && hasPrev && (
                <button className="lightbox-nav lightbox-prev" onClick={() => setSelectedResult(siblings[currentIdx - 1].jobId || siblings[currentIdx - 1].bannerId)}>‹</button>
              )}
              {siblings.length > 1 && hasNext && (
                <button className="lightbox-nav lightbox-next" onClick={() => setSelectedResult(siblings[currentIdx + 1].jobId || siblings[currentIdx + 1].bannerId)}>›</button>
              )}
              <img
                src={
                  viewTab === 'banners'      ? (r.bannerUrl)   :
                  viewTab === 'regenerated'  ? (r.regenUrl)    :
                                               (r.templateUrl)
                }
                className="lightbox-img"
              />
              <div className="lightbox-bar">
                <span className="lightbox-name">{r.label}{variations > 1 ? ` v${(r.variationIndex ?? 0) + 1}` : ''}</span>
                {siblings.length > 1 && <span className="lightbox-pos">{currentIdx + 1}/{siblings.length}</span>}
                <span className="lightbox-dims">{r.width}×{r.height}</span>
                {variations > 1 && (
                  <button
                    className={`fav-btn lightbox-fav ${isFav ? 'active' : ''}`}
                    onClick={() => toggleFavorite(r.bannerId, selectedResult)}
                  >{isFav ? '★' : '☆'}</button>
                )}
                <a
                  href={r.bannerUrl}
                  target="_blank"
                  className="dl-btn"
                >↓ Download</a>
              </div>
            </div>
          </div>
        )
      })()}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@300;400;500&display=swap');

        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
          --bg: #fafafa;
          --surface: #ffffff;
          --surface-2: #f5f5f5;
          --surface-3: #ebebeb;
          --border: rgba(0,0,0,0.08);
          --border-hover: rgba(0,0,0,0.16);
          --text: #1a1a1a;
          --text-dim: #6b6b6b;
          --text-muted: #a0a0a0;
          --accent: #1a1a1a;
          --accent-dim: rgba(0,0,0,0.05);
          --accent-hover: #333;
          --accent-glow: rgba(0,0,0,0.08);
          --green: #1a8754;
          --green-dim: rgba(26,135,84,0.08);
          --red: #dc3545;
          --red-dim: rgba(220,53,69,0.08);
          --blue: #2563eb;
          --mono: 'JetBrains Mono', 'SF Mono', monospace;
          --sans: 'DM Sans', 'Inter', -apple-system, system-ui, sans-serif;
          --display: 'Inter', -apple-system, system-ui, sans-serif;
          --radius: 8px;
        }

        .app {
          font-family: var(--sans);
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
          padding: 0 32px; height: 64px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
          z-index: 100;
        }
        .header-left, .header-right { display: flex; align-items: center; }

        .back-btn {
          width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border);
          background: transparent; color: var(--text-dim); font-size: 16px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s; font-family: var(--sans);
        }
        .back-btn:hover { color: var(--text); background: var(--surface-2); border-color: var(--border-hover); }
        .brand { display: flex; align-items: center; gap: 14px; }
        .brand-mark {
          width: 36px; height: 36px; border-radius: 50%;
          background: var(--text);
          display: flex; align-items: center; justify-content: center;
          font-family: serif; font-weight: 400; font-size: 18px; color: #fff;
          font-style: italic;
        }
        .brand-text { display: flex; align-items: baseline; gap: 10px; }
        .brand-name { font-family: var(--sans); font-weight: 600; font-size: 15px; color: var(--text); letter-spacing: -0.3px; }
        .brand-divider { color: var(--text-muted); font-weight: 300; font-size: 18px; }
        .brand-sub { color: var(--text-dim); font-weight: 400; font-size: 13px; letter-spacing: -0.2px; }

        .model-switch {
          display: flex; gap: 4px; background: var(--surface-2); border-radius: 10px;
          padding: 3px;
        }
        .model-opt {
          display: flex; flex-direction: column; align-items: flex-start;
          padding: 8px 20px; border: none; border-radius: 8px;
          background: transparent; cursor: pointer; transition: all 0.2s;
          min-width: 140px;
        }
        .model-opt .model-label {
          font-family: var(--sans); font-size: 12px; font-weight: 600;
          color: var(--text-dim); letter-spacing: -0.2px; transition: color 0.15s;
        }
        .model-opt .model-desc {
          font-family: var(--sans); font-size: 10px; color: var(--text-muted);
          margin-top: 1px; transition: color 0.15s;
        }
        .model-opt.active { background: var(--surface); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
        .model-opt.active .model-label { color: var(--text); }
        .model-opt.active .model-desc { color: var(--text-dim); }
        .model-opt:hover:not(.active) .model-label { color: var(--text); }

        /* ===== MAIN LAYOUT ===== */
        .main {
          flex: 1; overflow: hidden;
          padding: 24px 32px;
          display: flex; flex-direction: column;
        }
        .workspace {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 24px;
          flex: 1;
          min-height: 0;
        }

        /* ===== SIDEBAR ===== */
        .sidebar {
          display: flex; flex-direction: column; gap: 16px;
          overflow-y: auto; min-height: 0;
          padding-right: 4px;
        }
        .sidebar::-webkit-scrollbar { width: 3px; }
        .sidebar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 99px; }

        .panel {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 12px; padding: 20px;
          transition: all 0.2s; flex-shrink: 0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .panel:hover { border-color: var(--border-hover); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .panel-label {
          font-family: var(--sans); font-size: 11px; font-weight: 600;
          color: var(--text-dim); text-transform: uppercase; letter-spacing: 1.2px;
          margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
        }
        .panel-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 16px;
        }
        .panel-header .panel-label { margin-bottom: 0; }
        .panel-header.clickable { cursor: pointer; margin-bottom: 0; }
        .panel-header.clickable:hover .panel-label { color: var(--text); }

        .link-btn {
          background: none; border: none; font-family: var(--sans);
          font-size: 11px; color: var(--text-dim); cursor: pointer;
          font-weight: 600; transition: color 0.15s; padding: 0;
          text-decoration: underline; text-underline-offset: 2px;
        }
        .link-btn:hover { color: var(--text); }

        .chevron {
          font-size: 18px; color: var(--text-muted); font-weight: 300;
          transition: transform 0.2s; display: inline-block;
        }
        .chevron.open { transform: rotate(90deg); }

        /* ===== DROPZONE ===== */
        .dropzone {
          border: 2px dashed rgba(0,0,0,0.12); border-radius: 12px;
          padding: 32px 20px; text-align: center; cursor: pointer;
          transition: all 0.25s;
        }
        .dropzone:hover { border-color: var(--text); background: var(--surface-2); }
        .dropzone.drag-over { border-color: var(--text); background: var(--surface-2); box-shadow: 0 0 0 4px rgba(0,0,0,0.04); }
        .dropzone.has-file { border-style: solid; border-width: 1px; border-color: var(--border); padding: 12px; }
        .dropzone.has-file:hover { border-color: var(--border-hover); background: transparent; }

        .upload-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .upload-arrow {
          font-size: 20px; color: var(--text); font-weight: 300;
          width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;
          border: 1px solid var(--border); border-radius: 50%; margin-bottom: 4px;
          background: var(--surface-2);
        }
        .upload-text { font-size: 14px; color: var(--text); font-weight: 500; letter-spacing: -0.2px; }
        .upload-formats { font-size: 11px; color: var(--text-muted); }

        .upload-preview { display: flex; align-items: center; gap: 14px; }
        .upload-thumb {
          width: 56px; height: 56px; border-radius: 8px; object-fit: cover;
          border: 1px solid var(--border);
        }
        .upload-name { font-size: 13px; font-weight: 600; color: var(--text); letter-spacing: -0.2px; }
        .upload-meta { font-size: 11px; color: var(--text-dim); margin-top: 2px; }
        .upload-change { font-size: 11px; color: var(--text-dim); margin-top: 4px; cursor: pointer; font-weight: 500; text-decoration: underline; }
        .upload-change:hover { color: var(--text); }

        /* ===== FORMAT LIST ===== */
        .format-list {
          display: flex; flex-direction: column; gap: 2px;
        }
        .format-row {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; padding: 10px 10px; border-radius: 8px;
          transition: all 0.15s; border: 1px solid transparent;
        }
        .format-row:hover { background: var(--surface-2); }
        .format-row.on { background: var(--surface-2); border-color: var(--border); }
        .format-main { display: flex; align-items: center; gap: 12px; cursor: pointer; flex: 1; }

        .format-toggle {
          width: 28px; height: 16px; border-radius: 8px;
          background: var(--surface-3); border: 1px solid var(--border);
          position: relative; transition: all 0.2s; flex-shrink: 0;
        }
        .format-toggle.on { background: var(--text); border-color: var(--text); }
        .format-toggle-dot {
          width: 12px; height: 12px; border-radius: 50%;
          background: #fff; position: absolute; top: 1px; left: 1px;
          transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.15);
        }
        .format-toggle.on .format-toggle-dot { left: 13px; }

        .format-info { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
        .format-name { font-size: 13px; font-weight: 500; color: var(--text); letter-spacing: -0.2px; }
        .format-spec { font-size: 11px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
        .format-ratio { font-size: 10px; color: var(--text-muted); }

        .format-actions { display: flex; align-items: center; gap: 4px; }
        .ghost-btn {
          padding: 4px 10px; border-radius: 6px;
          border: 1px solid var(--border); background: transparent;
          color: var(--text-dim); font-family: var(--sans); font-size: 10px;
          cursor: pointer; transition: all 0.15s; font-weight: 500;
        }
        .ghost-btn:hover { color: var(--text); border-color: var(--border-hover); background: var(--surface-2); }
        .ghost-btn.warn { color: var(--red); border-color: rgba(220,53,69,0.2); }
        .ghost-btn.warn:hover { background: var(--red-dim); }
        .ghost-btn.note-toggle { font-size: 12px; padding: 3px 8px; }
        .ghost-btn.note-toggle.has-note { color: var(--text); border-color: var(--border-hover); background: var(--surface-2); }
        .ghost-btn.note-toggle.active { background: var(--surface-2); color: var(--text); border-color: var(--border-hover); }

        .banner-note-box {
          width: 100%; padding: 8px 10px 8px; border-top: 1px solid var(--border);
        }
        .banner-note-input {
          width: 100%; resize: vertical; padding: 8px 10px; border-radius: 8px;
          border: 1px solid var(--border); background: var(--surface-2);
          color: var(--text); font-family: var(--sans); font-size: 12px; line-height: 1.5;
          outline: none; transition: border-color 0.15s; box-sizing: border-box;
        }
        .banner-note-input:focus { border-color: var(--text); }
        .banner-note-input::placeholder { color: var(--text-muted); }

        .tag-custom {
          font-size: 9px; color: var(--green); background: var(--green-dim);
          padding: 2px 7px; border-radius: 4px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .tag-mod {
          font-size: 9px; color: var(--text-dim); background: var(--surface-2);
          padding: 2px 7px; border-radius: 4px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.5px;
        }

        /* ===== NEW FORMAT ===== */
        .new-format-row {
          display: flex; gap: 8px; margin-top: 12px; padding-top: 12px;
          border-top: 1px solid var(--border);
        }
        .new-format-input {
          flex: 1; padding: 8px 12px; border-radius: 8px;
          border: 1px solid var(--border); background: var(--surface-2);
          color: var(--text); font-family: var(--sans); font-size: 12px;
          outline: none; transition: border-color 0.15s;
        }
        .new-format-input:focus { border-color: var(--text); }
        .new-format-input::placeholder { color: var(--text-muted); }
        .new-format-btn {
          padding: 8px 16px; border-radius: 8px; border: 1px solid var(--text);
          background: transparent; color: var(--text); font-family: var(--sans);
          font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s;
          white-space: nowrap;
        }
        .new-format-btn:hover:not(:disabled) { background: var(--text); color: #fff; }
        .new-format-btn:disabled { opacity: 0.2; cursor: not-allowed; }

        /* ===== PROMPT ===== */
        .prompt-section { margin-top: 16px; animation: fadeIn 0.15s ease; }
        .prompt-hint {
          font-size: 11px; color: var(--text-dim); margin-bottom: 10px; line-height: 1.6;
        }
        .prompt-hint code {
          color: var(--text); background: var(--surface-2);
          padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 500;
          font-family: var(--mono);
        }
        .prompt-editor {
          width: 100%; background: var(--surface-2); border: 1px solid var(--border);
          border-radius: 8px; color: var(--text); padding: 14px;
          font-family: var(--mono); font-size: 11px; resize: vertical;
          outline: none; line-height: 1.8; transition: border-color 0.15s;
        }
        .prompt-editor:focus { border-color: var(--text); }
        .prompt-footer {
          display: flex; justify-content: space-between; align-items: center; margin-top: 8px;
        }
        .prompt-count { font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums; }

        /* ===== GENERATE BUTTON ===== */
        .gen-btn {
          width: 100%; padding: 16px; border-radius: 12px; border: none;
          background: var(--text); color: #fff;
          font-family: var(--sans); font-size: 14px; font-weight: 600;
          cursor: pointer; transition: all 0.25s; letter-spacing: -0.3px;
          flex-shrink: 0;
          margin-top: auto;
        }
        .gen-btn:hover:not(.off) {
          background: var(--accent-hover);
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }
        .gen-btn:active:not(.off) { transform: translateY(0); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .gen-btn.off { opacity: 0.15; cursor: not-allowed; }
        .gen-inner { display: flex; align-items: center; justify-content: center; gap: 10px; }
        .gen-arrow { font-size: 16px; font-weight: 300; }

        .gen-spinner {
          width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite;
        }

        /* ===== CANVAS / RESULTS AREA ===== */
        .canvas-area {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px; padding: 32px;
          display: flex; flex-direction: column;
          min-height: 0; overflow-y: auto;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }

        /* Progress */
        .progress-block { margin-bottom: 32px; animation: fadeIn 0.2s ease; }
        .progress-top {
          display: flex; justify-content: space-between; align-items: baseline;
          margin-bottom: 16px;
        }
        .progress-title {
          font-family: var(--sans); font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 1.2px; color: var(--text-dim);
        }
        .progress-frac {
          font-family: var(--display); font-size: 28px; font-weight: 700;
          color: var(--text); letter-spacing: -1px;
        }
        .progress-of { color: var(--text-muted); font-weight: 300; font-size: 20px; }
        .progress-track {
          height: 3px; background: var(--surface-3); border-radius: 2px;
          margin-bottom: 16px; overflow: hidden;
        }
        .progress-fill {
          height: 100%; background: var(--text); border-radius: 2px;
          transition: width 0.5s ease;
        }
        .progress-pills { display: flex; flex-wrap: wrap; gap: 6px; max-height: 200px; overflow-y: auto; }
        .pill {
          display: flex; align-items: center; gap: 6px; padding: 6px 12px;
          background: var(--surface-2); border-radius: 6px; font-size: 11px;
          border: 1px solid var(--border);
        }
        .pill-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
        }
        .pill-dot.regenerating, .pill-dot.compositing { background: var(--text); animation: pulse 1.2s infinite; }
        .pill-dot.done { background: var(--green); }
        .pill-dot.error { background: var(--red); }
        .pill-name { color: var(--text); font-weight: 500; }
        .pill-status { color: var(--text-dim); }

        /* Tabs + Results header */
        .results-bar {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 24px;
        }
        .tab-group { display: flex; gap: 0; }
        .tab {
          padding: 8px 18px; border: 1px solid var(--border); border-right: none;
          background: transparent; color: var(--text-dim); font-family: var(--sans);
          font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s;
        }
        .tab:first-child { border-radius: 8px 0 0 8px; }
        .tab:last-child { border-right: 1px solid var(--border); border-radius: 0 8px 8px 0; }
        .tab.active { background: var(--text); color: #fff; border-color: var(--text); }
        .tab.active + .tab { border-left-color: var(--text); }
        .tab:hover:not(.active) { color: var(--text); background: var(--surface-2); }
        .results-n { font-size: 11px; color: var(--text-dim); }
        .results-bar-right { display: flex; align-items: center; gap: 12px; }
        .dl-fav-btn {
          padding: 6px 14px; border-radius: 6px; font-family: var(--sans);
          font-size: 11px; font-weight: 600; background: var(--green-dim);
          color: var(--green); border: 1px solid rgba(26,135,84,0.15);
          cursor: pointer; transition: all 0.15s;
        }
        .dl-fav-btn:hover { background: rgba(26,135,84,0.12); border-color: rgba(26,135,84,0.3); }

        /* Variations Slider */
        .variations-row {
          display: flex; align-items: center; gap: 14px;
        }
        .variations-slider {
          flex: 1; height: 3px; -webkit-appearance: none; appearance: none;
          background: var(--surface-3); border-radius: 2px; outline: none;
          cursor: pointer;
        }
        .variations-slider::-webkit-slider-thumb {
          -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%;
          background: var(--text); cursor: pointer; border: 3px solid var(--surface);
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        }
        .variations-count {
          font-family: var(--display); font-size: 28px; font-weight: 700;
          color: var(--text); min-width: 32px; text-align: center;
          letter-spacing: -1px;
        }
        .variations-hint {
          font-size: 11px; color: var(--text-muted); margin-top: 10px;
          letter-spacing: -0.1px;
        }

        /* Grouped Results */
        .results-grouped {
          display: flex; flex-direction: column; gap: 24px;
          animation: fadeIn 0.3s ease;
        }
        .format-group {
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: 12px; padding: 20px; transition: all 0.2s;
        }
        .format-group:hover { border-color: var(--border-hover); }
        .format-group-header {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 16px; padding-bottom: 12px;
          border-bottom: 1px solid var(--border);
        }
        .format-group-name {
          font-family: var(--sans); font-size: 15px; font-weight: 600;
          color: var(--text); letter-spacing: -0.3px;
        }
        .format-group-dims {
          font-size: 11px; color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }
        .format-group-count {
          font-size: 10px; color: var(--text-dim); background: var(--surface);
          padding: 3px 10px; border-radius: 12px; font-weight: 600;
          border: 1px solid var(--border);
        }
        .variation-row {
          display: flex; gap: 12px; overflow-x: auto;
          padding-bottom: 4px;
        }
        .variation-row.single { justify-content: flex-start; }
        .variation-row .result-card {
          min-width: 220px; max-width: 300px; flex-shrink: 0;
        }
        .variation-row.single .result-card { min-width: 260px; }

        .result-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 10px; overflow: hidden; cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .result-card:hover { border-color: var(--border-hover); box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .result-card.favorited { border-color: #d4a017; box-shadow: 0 0 0 1px #d4a017, 0 4px 16px rgba(212,160,23,0.12); }
        .result-img-wrap { padding: 12px; background: var(--surface); position: relative; }
        .result-img {
          width: 100%; height: 170px; object-fit: contain; display: block;
          border-radius: 6px;
        }
        .variation-badge {
          position: absolute; top: 16px; left: 16px;
          font-size: 10px; font-weight: 600; color: #fff;
          background: var(--text); padding: 3px 8px; border-radius: 5px;
          letter-spacing: 0.3px; font-family: var(--sans);
        }
        .result-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 14px; border-top: 1px solid var(--border);
        }
        .result-info { display: flex; flex-direction: column; }
        .result-name { font-size: 12px; font-weight: 600; color: var(--text); letter-spacing: -0.2px; }
        .result-dims { font-size: 10px; color: var(--text-muted); margin-top: 2px; font-variant-numeric: tabular-nums; }
        .result-actions { display: flex; align-items: center; gap: 6px; }

        .fav-btn {
          background: none; border: 1px solid var(--border); border-radius: 6px;
          color: var(--text-muted); font-size: 14px; cursor: pointer;
          padding: 4px 8px; transition: all 0.15s; line-height: 1;
        }
        .fav-btn:hover { color: #d4a017; border-color: rgba(212,160,23,0.3); }
        .fav-btn.active { color: #d4a017; border-color: #d4a017; background: rgba(212,160,23,0.06); }

        .dl-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 14px; border-radius: 6px; font-family: var(--sans);
          font-size: 11px; font-weight: 600; background: var(--text);
          color: #fff; text-decoration: none; transition: all 0.15s;
          border: none;
        }
        .dl-btn:hover { background: var(--accent-hover); }

        /* Empty state */
        .empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; text-align: center; gap: 16px;
        }
        .empty-graphic {
          width: 80px; height: 80px; border-radius: 20px;
          background: var(--surface-2); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-muted); opacity: 0.6;
        }
        .empty-text {
          font-family: var(--sans); font-size: 22px; font-weight: 600;
          color: var(--text-dim); letter-spacing: -0.5px;
        }
        .empty-sub {
          font-size: 13px; color: var(--text-muted); line-height: 1.7;
          max-width: 280px;
        }
        .empty-steps {
          display: flex; gap: 8px; margin-top: 8px;
        }
        .empty-step {
          display: flex; align-items: center; gap: 7px;
          font-size: 11px; color: var(--text-dim);
          background: var(--surface-2); border: 1px solid var(--border);
          padding: 6px 12px; border-radius: 20px;
        }
        .empty-step-num {
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--text); color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; flex-shrink: 0;
        }

        /* ===== LIGHTBOX ===== */
        .lightbox {
          position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.85);
          display: flex; align-items: center; justify-content: center;
          animation: fadeIn 0.2s ease; padding: 40px;
          backdrop-filter: blur(12px);
        }
        .lightbox-body {
          max-width: 90vw; max-height: 90vh; position: relative;
          display: flex; flex-direction: column; align-items: center; gap: 16px;
        }
        .lightbox-x {
          position: absolute; top: -40px; right: 0; background: rgba(255,255,255,0.1); border: none;
          color: #fff; cursor: pointer; font-size: 18px; font-weight: 400;
          font-family: var(--sans); transition: all 0.15s;
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
        }
        .lightbox-x:hover { background: rgba(255,255,255,0.2); }
        .lightbox-img {
          max-width: 100%; max-height: 74vh; object-fit: contain; border-radius: 8px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.3);
        }
        .lightbox-bar {
          display: flex; align-items: center; gap: 16px; font-size: 13px; color: #fff;
        }
        .lightbox-nav {
          position: absolute; top: 50%; transform: translateY(-50%);
          background: rgba(255,255,255,0.1); border: none;
          color: #fff; font-size: 24px; font-weight: 300;
          width: 44px; height: 64px; border-radius: 8px;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all 0.15s; font-family: var(--sans); z-index: 10;
          backdrop-filter: blur(8px);
        }
        .lightbox-nav:hover { background: rgba(255,255,255,0.2); }
        .lightbox-prev { left: -60px; }
        .lightbox-next { right: -60px; }
        .lightbox-name { font-weight: 600; color: #fff; }
        .lightbox-pos { font-size: 11px; color: rgba(255,255,255,0.5); }
        .lightbox-dims { color: rgba(255,255,255,0.6); font-variant-numeric: tabular-nums; }
        .lightbox-fav { font-size: 18px; color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.2); }
        .lightbox-fav.active { color: #ffc832; border-color: #ffc832; }

        .lightbox .dl-btn { background: rgba(255,255,255,0.15); color: #fff; border: none; backdrop-filter: blur(4px); }
        .lightbox .dl-btn:hover { background: rgba(255,255,255,0.25); }

        /* ===== ANIMATIONS ===== */
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 900px) {
          .workspace { grid-template-columns: 1fr; }
          .canvas-area { min-height: 300px; }
          .main { padding: 16px; }
          .header { padding: 0 16px; }
        }

        /* Focus */
        :focus-visible { outline: 2px solid var(--text); outline-offset: 2px; border-radius: 4px; }

        /* Selection */
        ::selection { background: rgba(0,0,0,0.12); color: var(--text); }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }
      `}</style>
    </div>
  )
}
