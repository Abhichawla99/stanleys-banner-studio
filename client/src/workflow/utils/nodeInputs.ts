import { type Node, type Edge } from '@xyflow/react'

/**
 * Shared input resolver for image-generation nodes.
 * Handles Brand Kit and Campaign Context nodes by prepending their text
 * as context to the final prompt. Style-reference images from Brand Kit
 * are added to referenceImages.
 */
export function getNodeInputs(
  edges: Edge[],
  nodes: Node[],
  targetId: string,
  ownPrompt: string,
): { prompt: string; referenceImages: string[] } {
  const connectedEdges = edges.filter(e => e.target === targetId)
  let mainPrompt = ownPrompt
  const referenceImages: string[] = []
  const contextParts: string[] = []

  for (const edge of connectedEdges) {
    const src = nodes.find(n => n.id === edge.source)
    const d = (src?.data as Record<string, unknown>) ?? {}

    if (src?.type === 'brandKit' || src?.type === 'campaignContext') {
      const txt = (d.text as string) ?? ''
      if (txt) contextParts.push(txt)
      // Brand Kit may also expose a style reference image
      const img = d.imageUrl as string
      if (img) referenceImages.push(img)
    } else {
      const imgUrl = d.imageUrl as string
      if (imgUrl) {
        referenceImages.push(imgUrl)
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
