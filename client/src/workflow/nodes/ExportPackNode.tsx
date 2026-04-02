import { Handle, Position, type NodeProps, useEdges } from '@xyflow/react'
import { Package, Download } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'
import { registerNodeRunner, unregisterNodeRunner } from '../nodeRunner'
import { createZip, urlToBytes } from '../utils/createZip'

function sanitize(name: string): string {
  return name.replace(/[^a-z0-9_\-. ]/gi, '_').trim().replace(/\s+/g, '_') || 'file'
}

function extForUrl(url: string): string {
  if (url.startsWith('data:video')) return 'mp4'
  if (url.startsWith('data:image/png')) return 'png'
  if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) return 'jpg'
  if (url.startsWith('data:image/webp')) return 'webp'
  if (/\.mp4(\?|$)/.test(url)) return 'mp4'
  if (/\.webm(\?|$)/.test(url)) return 'webm'
  return 'png'
}

interface CollectedOutput {
  nodeId: string
  nodeType: string
  imageUrl?: string
  videoUrl?: string
  text?: string
  prompt?: string
}

export function ExportPackNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const edges = useEdges()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}

  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [packMsg, setPackMsg] = useState('')
  const runRef = useRef<() => Promise<void>>(async () => {})

  const campaignName = (data.campaignName as string) ?? 'campaign-export'
  const includeManifest = (data.includeManifest as boolean) ?? true

  function collectOutputs(): CollectedOutput[] {
    const collected: CollectedOutput[] = []
    for (const edge of edges.filter(e => e.target === id)) {
      const src = nodes.find(n => n.id === edge.source)
      if (!src) continue
      const d = (src.data as Record<string, unknown>) ?? {}
      collected.push({
        nodeId: src.id,
        nodeType: src.type ?? 'unknown',
        imageUrl: d.imageUrl as string | undefined,
        videoUrl: d.videoUrl as string | undefined,
        text: (d.text as string | undefined) ?? (d.output as string | undefined),
        prompt: (d.prompt as string | undefined) ?? (d.text as string | undefined),
      })
    }
    return collected
  }

  async function run() {
    const outputs = collectOutputs()
    if (outputs.length === 0) { setError('Connect output nodes to export'); return }

    const mediaOutputs = outputs.filter(o => o.imageUrl || o.videoUrl)
    if (mediaOutputs.length === 0) { setError('No image/video outputs found in connected nodes'); return }

    setStatus('loading')
    setError('')

    try {
      const folderName = sanitize(campaignName) || 'campaign'
      const zipFiles: { name: string; data: Uint8Array }[] = []
      const manifestEntries: Record<string, unknown>[] = []

      for (let i = 0; i < outputs.length; i++) {
        const o = outputs[i]
        const nodeLabel = sanitize(`${o.nodeType}_${i + 1}`)

        if (o.imageUrl) {
          setPackMsg(`Packing ${nodeLabel}...`)
          const ext = extForUrl(o.imageUrl)
          const filename = `${folderName}/${nodeLabel}.${ext}`
          const bytes = await urlToBytes(o.imageUrl)
          zipFiles.push({ name: filename, data: bytes })
          manifestEntries.push({
            filename,
            nodeId: o.nodeId,
            nodeType: o.nodeType,
            type: 'image',
            prompt: o.prompt ?? '',
            generatedAt: new Date().toISOString(),
          })
        }

        if (o.videoUrl) {
          setPackMsg(`Packing ${nodeLabel} video...`)
          const ext = extForUrl(o.videoUrl)
          const filename = `${folderName}/${nodeLabel}_video.${ext}`
          try {
            const bytes = await urlToBytes(o.videoUrl)
            zipFiles.push({ name: filename, data: bytes })
            manifestEntries.push({
              filename,
              nodeId: o.nodeId,
              nodeType: o.nodeType,
              type: 'video',
              prompt: o.prompt ?? '',
              generatedAt: new Date().toISOString(),
            })
          } catch {
            // Video URLs (like Kling CDN) may not be CORS-fetchable; skip gracefully
          }
        }

        if (o.text && !o.imageUrl && !o.videoUrl) {
          const enc = new TextEncoder()
          const filename = `${folderName}/${nodeLabel}.txt`
          zipFiles.push({ name: filename, data: enc.encode(o.text) })
          manifestEntries.push({ filename, nodeId: o.nodeId, nodeType: o.nodeType, type: 'text', generatedAt: new Date().toISOString() })
        }
      }

      if (includeManifest) {
        const manifest = {
          campaign: campaignName,
          exportedAt: new Date().toISOString(),
          totalFiles: zipFiles.length,
          files: manifestEntries,
        }
        const enc = new TextEncoder()
        zipFiles.push({ name: `${folderName}/manifest.json`, data: enc.encode(JSON.stringify(manifest, null, 2)) })
      }

      if (zipFiles.length === 0) {
        setError('No exportable files found')
        setStatus('error')
        return
      }

      setPackMsg('Building ZIP...')
      const zipBytes = createZip(zipFiles)
      const blob = new Blob([zipBytes.buffer as ArrayBuffer], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${sanitize(campaignName) || 'campaign'}.zip`
      a.click()
      URL.revokeObjectURL(url)

      updateNodeData(id, { lastExportedAt: new Date().toISOString(), fileCount: zipFiles.length })
      setStatus('done')
      setPackMsg('')
    } catch (e: any) {
      setError(e.message)
      setStatus('error')
    }
  }

  runRef.current = run
  useEffect(() => {
    registerNodeRunner(id, () => runRef.current())
    return () => unregisterNodeRunner(id)
  }, [id])

  const connectedCount = edges.filter(e => e.target === id).length
  const lastExportedAt = (data.lastExportedAt as string) ?? ''
  const fileCount = (data.fileCount as number) ?? 0

  return (
    <div className={`node-wrapper ${selected ? 'selected' : ''}`} data-node-type="exportPack" style={{ minWidth: 300 }}>
      <Handle type="target" position={Position.Left} style={{ top: '50%' }} />
      <div className="node-header">
        <Package size={13} color="#a3e635" />
        <span style={{ color: '#a3e635' }}>Export Pack</span>
        <span style={{ marginLeft: 'auto' }} className={`status-badge status-${status}`}>
          {status === 'loading' && <div className="spinner" />}
          {status}
        </span>
        <NodeMenu id={id} />
      </div>
      <div className="node-body">

        <div>
          <div className="field-label">Campaign / ZIP Filename</div>
          <input
            type="text"
            value={campaignName}
            onChange={e => updateNodeData(id, { campaignName: e.target.value })}
            placeholder="my-campaign-2025"
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: 'var(--t2)' }}>
          <input
            type="checkbox"
            checked={includeManifest}
            onChange={e => updateNodeData(id, { includeManifest: e.target.checked })}
            style={{ accentColor: 'var(--accent)' }}
          />
          Include manifest.json (metadata)
        </label>

        <div style={{ fontSize: 11, color: 'var(--t3)', background: 'var(--s3)', borderRadius: 6, padding: '6px 9px' }}>
          {connectedCount > 0
            ? `${connectedCount} node${connectedCount !== 1 ? 's' : ''} connected — connect image/video/text output nodes`
            : 'Connect output nodes (Image Viewer, Video Viewer, etc.)'}
        </div>

        {packMsg && (
          <div style={{ fontSize: 10, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <div className="spinner" /> {packMsg}
          </div>
        )}

        {error && <div style={{ color: 'var(--red)', fontSize: 11 }}>{error}</div>}

        <button className="btn-run" onClick={run} disabled={status === 'loading'} style={{ background: '#a3e63520', border: '1px solid #a3e63540', color: '#a3e635' }}>
          {status === 'loading'
            ? <><div className="spinner" /> Packing...</>
            : <><Download size={13} /> Download ZIP</>}
        </button>

        {lastExportedAt && status === 'done' && (
          <div style={{ fontSize: 10, color: 'var(--t3)', textAlign: 'center' }}>
            Last export: {fileCount} file{fileCount !== 1 ? 's' : ''} — {new Date(lastExportedAt).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  )
}
