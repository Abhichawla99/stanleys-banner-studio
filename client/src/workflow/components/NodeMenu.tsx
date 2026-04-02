import { MoreHorizontal, Trash2, Copy } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNodeStore } from '../store'

export function NodeMenu({ id }: { id: string }) {
  const [open, setOpen] = useState(false)
  const { deleteNode, duplicateNode } = useNodeStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div
      ref={ref}
      style={{ position: 'absolute', top: 7, right: 8, zIndex: 20 }}
      onMouseDown={e => e.stopPropagation()}
    >
      <button
        className="node-menu-btn"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
      >
        <MoreHorizontal size={13} />
      </button>

      {open && (
        <div className="node-menu-dropdown">
          <button onClick={() => { duplicateNode(id); setOpen(false) }}>
            <Copy size={11} /> Duplicate
          </button>
          <button className="danger" onClick={() => { deleteNode(id); setOpen(false) }}>
            <Trash2 size={11} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}
