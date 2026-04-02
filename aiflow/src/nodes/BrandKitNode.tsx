import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Palette, Plus, X, Save, FolderOpen } from 'lucide-react'
import { useState, useRef } from 'react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

interface SavedKit {
  id: string
  name: string
  logo: string
  colors: string[]
  fonts: string
  tone: string
  styleRef: string
}

const STORAGE_KEY = 'aiflow_brand_kits'

function loadKits(): SavedKit[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function persistKits(kits: SavedKit[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(kits))
}

function buildContext(colors: string[], fonts: string, tone: string): string {
  const parts: string[] = []
  const validColors = colors.filter(c => c && c !== '#000000' && c !== '#ffffff')
  if (validColors.length > 0) parts.push(`Brand colors: ${validColors.join(', ')}`)
  if (fonts.trim()) parts.push(`Brand fonts: ${fonts.trim()}`)
  if (tone.trim()) parts.push(`Tone of voice: ${tone.trim()}`)
  return parts.join('. ')
}

export function BrandKitNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}

  const colors = (data.colors as string[]) ?? ['#7c6ff7']
  const fonts = (data.fonts as string) ?? ''
  const tone = (data.tone as string) ?? ''
  const logo = (data.logo as string) ?? ''
  const styleRef = (data.styleRef as string) ?? ''
  const kitName = (data.kitName as string) ?? 'My Brand'

  const [kits, setKits] = useState<SavedKit[]>(loadKits)
  const [showKits, setShowKits] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)
  const styleRefInput = useRef<HTMLInputElement>(null)

  function update(patch: Record<string, unknown>) {
    const newColors = (patch.colors as string[] | undefined) ?? colors
    const newFonts = (patch.fonts as string | undefined) ?? fonts
    const newTone = (patch.tone as string | undefined) ?? tone
    const newStyleRef = (patch.styleRef as string | undefined) ?? styleRef
    const ctx = buildContext(newColors, newFonts, newTone)
    updateNodeData(id, {
      ...patch,
      text: ctx,
      brandContext: ctx,
      imageUrl: (patch.styleRef !== undefined ? patch.styleRef : styleRef) || undefined,
    })
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => update({ logo: ev.target?.result as string })
    reader.readAsDataURL(file)
  }

  function handleStyleRefUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => update({ styleRef: ev.target?.result as string })
    reader.readAsDataURL(file)
  }

  function addColor() {
    if (colors.length >= 6) return
    update({ colors: [...colors, '#ffffff'] })
  }

  function removeColor(i: number) {
    update({ colors: colors.filter((_, idx) => idx !== i) })
  }

  function setColor(i: number, val: string) {
    const nc = [...colors]
    nc[i] = val
    update({ colors: nc })
  }

  function saveKit() {
    const kit: SavedKit = { id: (data.activeKitId as string) || Date.now().toString(), name: kitName, logo, colors, fonts, tone, styleRef }
    const existing = kits.find(k => k.id === kit.id)
    const newKits = existing ? kits.map(k => k.id === kit.id ? kit : k) : [...kits, kit]
    persistKits(newKits)
    setKits(newKits)
    updateNodeData(id, { activeKitId: kit.id })
  }

  function loadKit(kit: SavedKit) {
    const ctx = buildContext(kit.colors, kit.fonts, kit.tone)
    updateNodeData(id, {
      kitName: kit.name, logo: kit.logo, colors: kit.colors, fonts: kit.fonts,
      tone: kit.tone, styleRef: kit.styleRef, activeKitId: kit.id,
      text: ctx, brandContext: ctx, imageUrl: kit.styleRef || undefined,
    })
    setShowKits(false)
  }

  function deleteKit(kitId: string) {
    const newKits = kits.filter(k => k.id !== kitId)
    persistKits(newKits)
    setKits(newKits)
  }

  const ctx = buildContext(colors, fonts, tone)

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="brandKit" style={{ minWidth: 300 }}>
      <div className="node-header">
        <Palette size={13} color="#f43f5e" />
        <span style={{ color: '#f43f5e' }}>Brand Kit</span>
        <NodeMenu id={id} />
      </div>
      <div className="node-body">

        {/* Kit name + save/load */}
        <div>
          <div className="field-label">Kit Name</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={kitName}
              onChange={e => updateNodeData(id, { kitName: e.target.value })}
              placeholder="My Brand"
            />
            <button
              onClick={saveKit}
              style={{ flexShrink: 0, padding: '4px 9px', background: 'var(--accent)', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Save size={11} />
            </button>
            <button
              onClick={() => setShowKits(o => !o)}
              style={{ flexShrink: 0, padding: '4px 9px', background: 'var(--s3)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--t2)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <FolderOpen size={11} />
            </button>
          </div>
        </div>

        {/* Saved kits dropdown */}
        {showKits && kits.length > 0 && (
          <div style={{ background: 'var(--s1)', border: '1px solid var(--border2)', borderRadius: 7, overflow: 'hidden' }}>
            {kits.map(k => (
              <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ flex: 1, fontSize: 11, color: 'var(--t1)', cursor: 'pointer' }} onClick={() => loadKit(k)}>{k.name}</span>
                <button onClick={() => loadKit(k)} style={{ fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>Load</button>
                <button onClick={() => deleteKit(k.id)} style={{ color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={10} /></button>
              </div>
            ))}
            {kits.length === 0 && <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--t3)' }}>No saved kits</div>}
          </div>
        )}

        {/* Logo upload */}
        <div>
          <div className="field-label">Logo</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {logo && <img src={logo} alt="logo" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 5, border: '1px solid var(--border2)', background: '#fff', padding: 2 }} />}
            <button
              onClick={() => logoRef.current?.click()}
              style={{ flex: 1, padding: '5px 10px', background: 'var(--s3)', border: '1px dashed var(--border2)', borderRadius: 6, color: 'var(--t3)', fontSize: 11, cursor: 'pointer' }}
            >
              {logo ? 'Change Logo' : 'Upload Logo'}
            </button>
            <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
          </div>
        </div>

        {/* Brand Colors */}
        <div>
          <div className="field-label">Brand Colors (up to 6)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {colors.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'var(--s3)', borderRadius: 6, padding: '3px 6px', border: '1px solid var(--border2)' }}>
                <input
                  type="color"
                  value={c}
                  onChange={e => setColor(i, e.target.value)}
                  style={{ width: 22, height: 22, padding: 0, border: 'none', borderRadius: 3, cursor: 'pointer', background: 'none' }}
                />
                <input
                  type="text"
                  value={c}
                  onChange={e => setColor(i, e.target.value)}
                  style={{ width: 64, fontSize: 10, padding: '2px 4px' }}
                />
                {colors.length > 1 && (
                  <button onClick={() => removeColor(i)} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', padding: 1, display: 'flex' }}>
                    <X size={9} />
                  </button>
                )}
              </div>
            ))}
            {colors.length < 6 && (
              <button
                onClick={addColor}
                style={{ width: 30, height: 30, background: 'var(--s3)', border: '1px dashed var(--border2)', borderRadius: 6, color: 'var(--t3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Plus size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Brand Fonts */}
        <div>
          <div className="field-label">Brand Fonts</div>
          <input
            type="text"
            value={fonts}
            onChange={e => update({ fonts: e.target.value })}
            placeholder="e.g. Helvetica Neue, Playfair Display"
          />
        </div>

        {/* Tone of Voice */}
        <div>
          <div className="field-label">Tone of Voice</div>
          <textarea
            rows={2}
            value={tone}
            onChange={e => update({ tone: e.target.value })}
            placeholder="e.g. bold, confident, aspirational, minimal"
          />
        </div>

        {/* Style Reference Image */}
        <div>
          <div className="field-label">Style Reference Image</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {styleRef && <img src={styleRef} alt="style ref" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 5, border: '1px solid var(--border2)' }} />}
            <button
              onClick={() => styleRefInput.current?.click()}
              style={{ flex: 1, padding: '5px 10px', background: 'var(--s3)', border: '1px dashed var(--border2)', borderRadius: 6, color: 'var(--t3)', fontSize: 11, cursor: 'pointer' }}
            >
              {styleRef ? 'Change Reference' : 'Upload Reference'}
            </button>
            {styleRef && (
              <button onClick={() => update({ styleRef: '' })} style={{ color: 'var(--t3)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={12} />
              </button>
            )}
            <input ref={styleRefInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleStyleRefUpload} />
          </div>
        </div>

        {/* Context preview */}
        {ctx && (
          <div style={{ background: 'var(--s3)', borderRadius: 6, padding: '6px 9px', fontSize: 10, color: 'var(--t2)', lineHeight: 1.5, fontStyle: 'italic', borderLeft: '2px solid #f43f5e40' }}>
            {ctx}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ top: '50%' }} />
    </div>
  )
}
