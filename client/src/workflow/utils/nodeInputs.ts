import { type Node, type Edge } from '@xyflow/react'

export interface NamedImage {
  name: string
  url: string
}

/**
 * Shared input resolver for image-generation nodes.
 * Handles Brand Kit and Campaign Context nodes by prepending their text
 * as context to the final prompt. Style-reference images from Brand Kit
 * are added to referenceImages with names.
 */
export function getNodeInputs(
  edges: Edge[],
  nodes: Node[],
  targetId: string,
  ownPrompt: string,
): { prompt: string; referenceImages: NamedImage[] } {
  const connectedEdges = edges.filter(e => e.target === targetId)
  let mainPrompt = ownPrompt
  const referenceImages: NamedImage[] = []
  const contextParts: string[] = []
  let imgCounter = 1

  for (const edge of connectedEdges) {
    const src = nodes.find(n => n.id === edge.source)
    const d = (src?.data as Record<string, unknown>) ?? {}

    if (src?.type === 'brandKit' || src?.type === 'campaignContext') {
      const txt = (d.text as string) ?? ''
      if (txt) contextParts.push(txt)
      const img = d.imageUrl as string
      if (img) {
        const name = (d.title as string) || `brand_ref_${imgCounter}`
        referenceImages.push({ name, url: img })
        imgCounter++
      }
    } else {
      const imgUrl = d.imageUrl as string
      if (imgUrl) {
        // Use the node's title/label or generate a numbered name
        const name = (d.title as string) || (d.filename as string)?.replace(/\.[^.]+$/, '') || `image${imgCounter}`
        referenceImages.push({ name, url: imgUrl })
        imgCounter++
      } else {
        const txt = (d.text as string) ?? (d.output as string) ?? (d.prompt as string)
        if (txt) mainPrompt = txt
      }
    }
  }

  const prompt = contextParts.length > 0
    ? contextParts.join('. ') + (mainPrompt ? '. ' + mainPrompt : '')
    : mainPrompt

  return { prompt, referenceImages }
}

/**
 * Shared text resolver for LLM / text-processing nodes.
 * Brand Kit and Campaign Context context is prepended to the main text.
 */
export function getNodeText(
  edges: Edge[],
  nodes: Node[],
  targetId: string,
): string {
  const contextParts: string[] = []
  let mainText = ''

  for (const edge of edges.filter(e => e.target === targetId)) {
    const src = nodes.find(n => n.id === edge.source)
    const d = (src?.data as Record<string, unknown>) ?? {}

    if (src?.type === 'brandKit' || src?.type === 'campaignContext') {
      const txt = (d.text as string) ?? ''
      if (txt) contextParts.push(txt)
    } else {
      const txt = (d.text as string) ?? (d.output as string) ?? (d.lastPayload as string) ?? ''
      if (txt) mainText = txt
    }
  }

  return contextParts.length > 0
    ? contextParts.join('. ') + (mainText ? '. ' + mainText : '')
    : mainText
}
