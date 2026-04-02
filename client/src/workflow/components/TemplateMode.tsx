import { useState, useRef } from 'react'
import { type Node, type Edge } from '@xyflow/react'
import { BookTemplate, X, ChevronRight, Play, Check, Upload } from 'lucide-react'
import { useNodeStore } from '../store'

// ─── Field catalog — maps node type → editable fields ───────────────────────
interface FieldDef {
  key: string
  label: string
  type: 'text' | 'textarea' | 'image' | 'select'
  selectOptions?: string[]
  placeholder?: string
}

const NODE_FIELDS: Record<string, FieldDef[]> = {
  textInput:   [{ key: 'text', label: 'Text / Prompt', type: 'textarea', placeholder: 'Enter prompt...' }],
  llm:         [
    { key: 'systemPrompt', label: 'System Prompt', type: 'textarea' },
    { key: 'userPromptTpl', label: 'User Prompt Template', type: 'textarea' },
  ],
  nanoBanana:  [{ key: 'prompt', label: 'Image Prompt', type: 'textarea' }],
  gptImage:    [{ key: 'prompt', label: 'Image Prompt', type: 'textarea' }],
  imagen4:     [{ key: 'prompt', label: 'Image Prompt', type: 'textarea' }],
  flux:        [{ key: 'prompt', label: 'Image Prompt', type: 'textarea' }],
  kling:       [{ key: 'prompt', label: 'Video Prompt', type: 'textarea' }],
  veo:         [{ key: 'prompt', label: 'Video Prompt', type: 'textarea' }],
  fileUpload:  [{ key: 'imageUrl', label: 'Reference Image', type: 'image' }],
  promptBuilder: [{ key: 'subject', label: 'Subject', type: 'text' }, { key: 'style', label: 'Style', type: 'text' }],
  brandKit:    [
    { key: 'kitName', label: 'Brand Name', type: 'text' },
    { key: 'tone', label: 'Tone of Voice', type: 'textarea' },
  ],
  campaignContext: [
    { key: 'campaignName', label: 'Campaign Name', type: 'text' },
    { key: 'productName', label: 'Product / Service', type: 'text' },
    { key: 'targetAudience', label: 'Target Audience', type: 'textarea' },
    { key: 'keyMessage', label: 'Key Message', type: 'textarea' },
    { key: 'objective', label: 'Objective', type: 'select', selectOptions: ['awareness', 'consideration', 'conversion', 'retention'] },
    { key: 'mood', label: 'Campaign Mood', type: 'select', selectOptions: ['energetic', 'luxurious', 'playful', 'professional', 'urgent'] },
  ],
}

// ─── Template types ───────────────────────────────────────────────────────────
export interface TemplateField {
  nodeId: string
  nodeType: string
  nodeLabel: string
  fieldKey: string
  fieldLabel: string
  fieldType: 'text' | 'textarea' | 'image' | 'select'
  selectOptions?: string[]
  userLabel: string       // user-facing label, editable in publish modal
  placeholder?: string
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  nodes: Node[]
  edges: Edge[]
  fields: TemplateField[]
  createdAt: string
}

const STORAGE_KEY = 'aiflow_templates'

function loadTemplates(): WorkflowTemplate[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function persistTemplates(t: WorkflowTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
}

// ─── Publish Template Modal ───────────────────────────────────────────────────
function PublishModal({ nodes, edges, onClose }: { nodes: Node[]; edges: Edge[]; onClose: () => void }) {
  const [name, setName] = useState('My Template')
  const [description, setDescription] = useState('')
  const [checkedFields, setCheckedFields] = useState<Set<string>>(new Set())
  const [userLabels, setUserLabels] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  // Build the list of available fields from all nodes
  const allFields: TemplateField[] = []
  for (const n of nodes) {
    const catalog = NODE_FIELDS[n.type ?? ''] ?? []
    for (const f of catalog) {
      const fieldKey = `${n.id}::${f.key}`
      allFields.push({
        nodeId: n.id,
        nodeType: n.type ?? 'unknown',
        nodeLabel: n.type ?? 'node',
        fieldKey: f.key,
        fieldLabel: f.label,
        fieldType: f.type,
        selectOptions: f.selectOptions,
        userLabel: userLabels[fieldKey] ?? f.label,
        placeholder: f.placeholder,
      })
    }
  }

  function toggle(fieldKey: string) {
    const next = new Set(checkedFields)
    if (next.has(fieldKey)) next.delete(fieldKey)
    else next.add(fieldKey)
    setCheckedFields(next)
  }

  function publish() {
    const selectedFields = allFields
      .filter(f => checkedFields.has(`${f.nodeId}::${f.fieldKey}`))
      .map(f => ({ ...f, userLabel: userLabels[`${f.nodeId}::${f.fieldKey}`] ?? f.fieldLabel }))

    const template: WorkflowTemplate = {
      id: Date.now().toString(),
      name,
      description,
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      fields: selectedFields,
      createdAt: new Date().toISOString(),
    }

    const existing = loadTemplates()
    persistTemplates([...existing, template])
    setSaved(true)
    setTimeout(onClose, 1200)
  }

  // Group by node
  const byNode: Record<string, TemplateField[]> = {}
  for (const f of allFields) {
    const key = `${f.nodeId}_${f.nodeType}`
    if (!byNode[key]) byNode[key] = []
    byNode[key].push(f)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: 520, maxHeight: '88vh', background: 'var(--s1)', border: '1px solid var(--border2)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.9)' }}>
        {/* Header */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookTemplate size={14} color="var(--accent)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Publish as Template</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Name & description */}
          <div>
            <div className="field-label">Template Name</div>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="My Campaign Template" />
          </div>
          <div>
            <div className="field-label">Description</div>
            <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this template do?" />
          </div>

          {/* Field selection */}
          <div>
            <div className="field-label" style={{ marginBottom: 8 }}>Mark fields as User Inputs</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 10 }}>
              Checked fields will appear as a simple form when running this template.
            </div>
            {Object.entries(byNode).map(([nodeKey, fields]) => (
              <div key={nodeKey} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, padding: '2px 0' }}>
                  {fields[0].nodeType} ({fields[0].nodeId.slice(-6)})
                </div>
                {fields.map(f => {
                  const fk = `${f.nodeId}::${f.fieldKey}`
                  const isChecked = checkedFields.has(fk)
                  return (
                    <div key={fk} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: isChecked ? 'var(--accent-bg)' : 'var(--s3)', borderRadius: 6, marginBottom: 4, border: `1px solid ${isChecked ? 'var(--accent)' : 'var(--border2)'}`, transition: 'all 0.1s' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(fk)}
                        style={{ accentColor: 'var(--accent)', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--t2)', flex: 1 }}>{f.fieldLabel}</span>
                      {isChecked && (
                        <input
                          type="text"
                          value={userLabels[fk] ?? f.fieldLabel}
                          onChange={e => setUserLabels(ul => ({ ...ul, [fk]: e.target.value }))}
                          placeholder="User-facing label"
                          style={{ width: 140, fontSize: 10, padding: '3px 6px' }}
                          onClick={e => e.stopPropagation()}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
            {allFields.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--t3)', padding: '8px 0' }}>No configurable fields found in current workflow.</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--s3)', color: 'var(--t2)', fontSize: 12, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={publish}
            disabled={!name.trim() || saved}
            style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: saved ? 'rgba(74,222,128,0.2)' : 'var(--accent)', color: saved ? '#4ade80' : 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {saved ? <><Check size={12} /> Saved!</> : <><BookTemplate size={12} /> Publish Template</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Template Runner ───────────────────────────────────────────────────────────
function TemplateRunner({
  template,
  onClose,
  onRun,
}: {
  template: WorkflowTemplate
  onClose: () => void
  onRun: (nodes: Node[], edges: Edge[]) => void
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of template.fields) {
      const nodeData = template.nodes.find(n => n.id === f.nodeId)?.data as Record<string, unknown> ?? {}
      init[`${f.nodeId}::${f.fieldKey}`] = (nodeData[f.fieldKey] as string) ?? ''
    }
    return init
  })

  const imageRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function handleImageUpload(fk: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setValues(v => ({ ...v, [fk]: ev.target?.result as string }))
    reader.readAsDataURL(file)
  }

  function submit() {
    // Inject values into template nodes
    const patchedNodes: Node[] = template.nodes.map(n => {
      const patches: Record<string, unknown> = {}
      for (const f of template.fields) {
        if (f.nodeId !== n.id) continue
        const fk = `${f.nodeId}::${f.fieldKey}`
        patches[f.fieldKey] = values[fk] ?? ''
      }
      return Object.keys(patches).length > 0
        ? { ...n, data: { ...(n.data as Record<string, unknown>), ...patches } }
        : n
    })
    onRun(patchedNodes, template.edges)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: 480, maxHeight: '90vh', background: 'var(--s1)', border: '1px solid var(--border2)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.9)' }}>
        {/* Header */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookTemplate size={14} color="var(--accent)" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{template.name}</div>
            {template.description && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>{template.description}</div>}
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {template.fields.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', padding: '20px 0' }}>
              This template has no user inputs. It will run with its saved settings.
            </div>
          )}
          {template.fields.map(f => {
            const fk = `${f.nodeId}::${f.fieldKey}`
            return (
              <div key={fk}>
                <div className="field-label">{f.userLabel}</div>
                {f.fieldType === 'text' && (
                  <input type="text" value={values[fk] ?? ''} onChange={e => setValues(v => ({ ...v, [fk]: e.target.value }))} placeholder={f.placeholder} />
                )}
                {f.fieldType === 'textarea' && (
                  <textarea rows={3} value={values[fk] ?? ''} onChange={e => setValues(v => ({ ...v, [fk]: e.target.value }))} placeholder={f.placeholder} />
                )}
                {f.fieldType === 'select' && (
                  <select value={values[fk] ?? ''} onChange={e => setValues(v => ({ ...v, [fk]: e.target.value }))}>
                    {(f.selectOptions ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                )}
                {f.fieldType === 'image' && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {values[fk] && <img src={values[fk]} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 5, border: '1px solid var(--border2)' }} />}
                    <button
                      onClick={() => imageRefs.current[fk]?.click()}
                      style={{ flex: 1, padding: '6px 10px', background: 'var(--s3)', border: '1px dashed var(--border2)', borderRadius: 6, color: 'var(--t3)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Upload size={11} /> {values[fk] ? 'Change Image' : 'Upload Image'}
                    </button>
                    <input
                      ref={el => { imageRefs.current[fk] = el }}
                      type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => handleImageUpload(fk, e)}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--s3)', color: 'var(--t2)', fontSize: 12, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={submit}
            style={{ padding: '6px 16px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Play size={11} /> Load & Run
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Template Library Modal ───────────────────────────────────────────────────
function TemplateLibrary({
  onClose,
  onRun,
}: {
  onClose: () => void
  onRun: (nodes: Node[], edges: Edge[]) => void
}) {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>(loadTemplates)
  const [running, setRunning] = useState<WorkflowTemplate | null>(null)

  function deleteTemplate(id: string) {
    const next = templates.filter(t => t.id !== id)
    persistTemplates(next)
    setTemplates(next)
  }

  if (running) {
    return <TemplateRunner template={running} onClose={() => setRunning(null)} onRun={onRun} />
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ width: 460, maxHeight: '80vh', background: 'var(--s1)', border: '1px solid var(--border2)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.9)' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookTemplate size={14} color="var(--accent)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Template Library</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 12, color: 'var(--t3)' }}>
              No templates yet. Use "Publish as Template" to save your workflow.
            </div>
          )}
          {templates.map(t => (
            <div key={t.id} style={{ background: 'var(--s2)', border: '1px solid var(--border2)', borderRadius: 9, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }}>{t.name}</div>
                {t.description && <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>{t.description}</div>}
                <div style={{ fontSize: 9, color: 'var(--t3)' }}>
                  {t.nodes.length} nodes · {t.fields.length} user input{t.fields.length !== 1 ? 's' : ''} · {new Date(t.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setRunning(t)}
                  style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <ChevronRight size={11} /> Use
                </button>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  style={{ padding: '5px 8px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--s3)', color: 'var(--t3)', fontSize: 11, cursor: 'pointer', display: 'flex' }}
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main export: Template Mode buttons for top bar ───────────────────────────
export function TemplateModeButtons() {
  const { nodes, edges, setNodes, setEdges, runWorkflow } = useNodeStore()
  const [showPublish, setShowPublish] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)

  function handleRunTemplate(templateNodes: Node[], templateEdges: Edge[]) {
    if (confirm('Load template? This replaces the current canvas.')) {
      setNodes(templateNodes)
      setEdges(templateEdges)
      setTimeout(() => runWorkflow(), 200)
    }
  }

  return (
    <>
      <button
        className="top-btn"
        onClick={() => setShowPublish(true)}
        style={{ background: 'rgba(124,111,247,0.08)', border: '1px solid rgba(124,111,247,0.3)', color: '#a78bfa' }}
        title="Publish current workflow as a reusable template"
      >
        <BookTemplate size={11} /> Publish Template
      </button>
      <button
        className="top-btn"
        onClick={() => setShowLibrary(true)}
        title="Open template library"
      >
        <BookTemplate size={11} /> Templates
      </button>

      {showPublish && <PublishModal nodes={nodes} edges={edges} onClose={() => setShowPublish(false)} />}
      {showLibrary && <TemplateLibrary onClose={() => setShowLibrary(false)} onRun={handleRunTemplate} />}
    </>
  )
}
