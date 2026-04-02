// Nano Banana 2 = Google Gemini 3.1 Flash Image (gemini-3.1-flash-image-preview)
// Also available via fal.ai as fal-ai/nano-banana-2

import type { NamedImage } from '../utils/nodeInputs'

const PROXY = 'http://localhost:3001'

export interface NanoBananaParams {
  prompt: string
  negativePrompt?: string
  aspectRatio?: string
  seed?: number
  apiKey: string
  provider: 'gemini' | 'fal'
  referenceImages?: NamedImage[] // named images with base64 data URLs or public URLs
}

export interface NanoBananaResult {
  imageUrl: string
  mimeType: string
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  if (!dataUrl.startsWith('data:')) return null
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return null
  const header = dataUrl.slice(0, comma)
  const data = dataUrl.slice(comma + 1)
  const mimeType = header.replace('data:', '').replace(';base64', '')
  return { mimeType, data }
}

/** Crop a data-URL image to the exact target aspect ratio (center crop). */
function cropToAspectRatio(dataUrl: string, ratio: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const [wStr, hStr] = ratio.split(':')
    const targetRatio = parseInt(wStr) / parseInt(hStr)
    if (!targetRatio || !isFinite(targetRatio)) { resolve(dataUrl); return }

    const img = new Image()
    img.onload = () => {
      const srcW = img.naturalWidth
      const srcH = img.naturalHeight
      const srcRatio = srcW / srcH

      // If already close enough (within 2%), skip cropping
      if (Math.abs(srcRatio - targetRatio) / targetRatio < 0.02) { resolve(dataUrl); return }

      let cropW: number, cropH: number
      if (srcRatio > targetRatio) {
        // Source is wider than target — crop sides
        cropH = srcH
        cropW = Math.round(srcH * targetRatio)
      } else {
        // Source is taller than target — crop top/bottom
        cropW = srcW
        cropH = Math.round(srcW / targetRatio)
      }
      const x = Math.round((srcW - cropW) / 2)
      const y = Math.round((srcH - cropH) / 2)

      const canvas = document.createElement('canvas')
      canvas.width = cropW
      canvas.height = cropH
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, x, y, cropW, cropH, 0, 0, cropW, cropH)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(dataUrl) // fallback to original on error
    img.src = dataUrl
  })
}

async function generateViaGemini(params: NanoBananaParams): Promise<NanoBananaResult> {
  const modelId = 'gemini-3.1-flash-image-preview'
  const refs = params.referenceImages ?? []

  // Build image parts with names embedded in text labels
  const parts: any[] = []
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i]
    // Add a text label before each image so the model knows what it is
    parts.push({ text: `[${ref.name}]:` })
    const parsed = parseDataUrl(ref.url)
    if (parsed) {
      parts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } })
    } else {
      parts.push({ fileData: { mimeType: 'image/jpeg', fileUri: ref.url } })
    }
  }

  // Build the prompt text referencing the images by name
  let promptText = params.prompt
  if (refs.length > 0) {
    const imageList = refs.map(r => r.name).join(', ')
    promptText = `You have ${refs.length} reference image(s) attached: ${imageList}.\n\n${params.prompt}`
  }

  // Include aspect ratio instruction in the prompt so the model generates the right shape
  const ar = params.aspectRatio ?? '1:1'
  if (ar !== '1:1') {
    promptText += `\n\nIMPORTANT: Generate the image in ${ar} aspect ratio.`
  }
  parts.push({ text: promptText })

  const body = {
    model: modelId,
    contents: [{ parts, role: 'user' }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      ...(params.seed !== undefined && { seed: params.seed }),
    },
  }

  const res = await fetch(`${PROXY}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Gemini-Key': params.apiKey },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const respParts = data?.candidates?.[0]?.content?.parts ?? []
  const imgPart = respParts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))

  if (!imgPart) {
    throw new Error('No image returned from Gemini API')
  }

  const mimeType = imgPart.inlineData.mimeType
  const b64 = imgPart.inlineData.data
  const rawUrl = `data:${mimeType};base64,${b64}`
  const croppedUrl = await cropToAspectRatio(rawUrl, params.aspectRatio ?? '1:1')
  return { imageUrl: croppedUrl, mimeType: 'image/png' }
}

async function generateViaFal(params: NanoBananaParams): Promise<NanoBananaResult> {
  const body: Record<string, unknown> = {
    modelId: 'fal-ai/nano-banana-2',
    prompt: params.prompt,
    ...(params.negativePrompt && { negative_prompt: params.negativePrompt }),
    ...(params.aspectRatio && { aspect_ratio: params.aspectRatio }),
    ...(params.seed !== undefined && { seed: params.seed }),
    ...(params.referenceImages?.length && { referenceImages: params.referenceImages.map(r => r.url) }),
  }

  const res = await fetch(`${PROXY}/api/fal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Fal-Key': params.apiKey },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`fal.ai API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const imageUrl = data?.images?.[0]?.url ?? data?.image?.url
  if (!imageUrl) throw new Error('No image URL in fal.ai response')
  return { imageUrl, mimeType: 'image/png' }
}

export async function generateImage(params: NanoBananaParams): Promise<NanoBananaResult> {
  if (params.provider === 'fal') {
    return generateViaFal(params)
  }
  return generateViaGemini(params)
}
