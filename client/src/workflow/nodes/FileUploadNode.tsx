import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Upload, X } from 'lucide-react'
import { useRef } from 'react'
import { useNodeStore } from '../store'
import { NodeMenu } from '../components/NodeMenu'

export function FileUploadNode({ id, selected }: NodeProps) {
  const { nodes, updateNodeData } = useNodeStore()
  const node = nodes.find(n => n.id === id)
  const data = (node?.data as Record<string, unknown>) ?? {}
  const inputRef = useRef<HTMLInputElement>(null)

  const imageUrl = (data.imageUrl as string) ?? ''
  const filename = (data.filename as string) ?? ''
  const title = (data.title as string) ?? 'File'
  const linkUrl = (data.linkUrl as string) ?? ''

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      updateNodeData(id, {
        imageUrl: dataUrl,
        linkUrl: '',
        filename: file.name,
        mimeType: file.type,
        text: `[Uploaded: ${file.name}]`,
      })
    }
    reader.readAsDataURL(file)
  }

  function onDropZone(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onLinkChange(url: string) {
    updateNodeData(id, { linkUrl: url, imageUrl: url, filename: url.split('/').pop() ?? 'image', text: `[Link: ${url}]` })
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    updateNodeData(id, { imageUrl: '', linkUrl: '', filename: '', text: '' })
  }

  return (
    <div
      className={`node-wrapper ${selected ? 'selected' : ''}`}
      data-node-type="fileUpload"
      style={{ minWidth: 260, padding: 0, overflow: 'hidden' }}
    >
      {/* Header */}
      <div className="node-header" style={{ padding: '8px 10px 8px 12px' }}>
        <input
          type="text"
          value={title}
          onChange={e => updateNodeData(id, { title: e.target.value })}
          onMouseDown={e => e.stopPropagation()}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--t1)', fontSize: 13, fontWeight: 600,
            fontFamily: 'inherit', width: '100%', padding: 0,
          }}
          placeholder="File"
        />
        {imageUrl && (
          <button
            onClick={clear}
            onMouseDown={e => e.stopPropagation()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 2, flexShrink: 0 }}
          >
            <X size={12} />
          </button>
        )}
        <NodeMenu id={id} />
      </div>

      {/* Image area */}
      <div
        onClick={() => !imageUrl && inputRef.current?.click()}
        onDrop={onDropZone}
        onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
        style={{
          position: 'relative',
          cursor: imageUrl ? 'default' : 'pointer',
          minHeight: 200,
          ...(imageUrl ? {} : { background: 'var(--checker)' }),
        }}
        className={imageUrl ? '' : 'checker-bg'}
      >
        {imageUrl ? (
          imageUrl.startsWith('data:video') || linkUrl.match(/\.(mp4|webm|mov)$/i) ? (
            <video
              src={imageUrl}
              controls
              style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'contain', background: '#000' }}
            />
          ) : (
            <img
              src={imageUrl}
              alt={filename}
              style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'contain' }}
            />
          )
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10,
          }}>
            <Upload size={22} color="rgba(255,255,255,0.2)" strokeWidth={1.5} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', fontWeight: 500 }}>
              Drag & drop or click to upload
            </span>
          </div>
        )}

        {/* Filename badge */}
        {imageUrl && filename && (
          <div style={{
            position: 'absolute', bottom: 8, left: 8,
            fontSize: 9, fontWeight: 600,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            color: 'rgba(255,255,255,0.7)',
            padding: '2px 7px', borderRadius: 4,
            maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {filename}
          </div>
        )}
      </div>

      {/* Paste link row */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '0' }}>
        <input
          type="text"
          value={linkUrl}
          onChange={e => onLinkChange(e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          placeholder="Paste a file link"
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            borderRadius: 0,
            color: 'var(--t2)',
            padding: '9px 12px',
            fontSize: 12,
          }}
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      <Handle type="source" position={Position.Right} style={{ top: '45%' }} />
    </div>
  )
}
