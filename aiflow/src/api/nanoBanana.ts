// Nano Banana 2 = Google Gemini 3.1 Flash Image (gemini-3.1-flash-image-preview)
// Also available via fal.ai as fal-ai/nano-banana-2

const PROXY = 'http://localhost:3001'

export interface NanoBananaParams {
  prompt: string
  negativePrompt?: string
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
  seed?: number
  apiKey: string
  provider: 'gemini' | 'fal'
  referenceImages?: string[] // base64 data URLs or public image URLs
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

async function generateViaGemini(params: NanoBananaParams): Promise<NanoBananaResult> {
  const modelId = 'gemini-3.1-flash-image-preview'
  const refs = params.referenceImages ?? []
  const imageParts = refs.map(img => {
    const parsed = parseDataUrl(img)
    if (parsed) return { inlineData: { mimeType: parsed.mimeType, data: parsed.data } }
    return { fileData: { mimeType: 'image/jpeg', fileUri: img } }
  })

  const promptText = refs.length > 0
    ? `Using these ${refs.length} reference image(s) as visual context and style inspiration, generate a new image: ${params.prompt}`
    : params.prompt

  const body = {
    model: modelId,
    contents: [{ parts: [...imageParts, { text: promptText }], role: 'user' }],
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
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const imgPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))

  if (!imgPart) {
    throw new Error('No image returned from Gemini API')
  }

  const mimeType = imgPart.inlineData.mimeType
  const b64 = imgPart.inlineData.data
  return { imageUrl: `data:${mimeType};base64,${b64}`, mimeType }
}

async function generateViaFal(params: NanoBananaParams): Promise<NanoBananaResult> {
  const body: Record<string, unknown> = {
    modelId: 'fal-ai/nano-banana-2',
    prompt: params.prompt,
    ...(params.negativePrompt && { negative_prompt: params.negativePrompt }),
    ...(params.aspectRatio && { aspect_ratio: params.aspectRatio }),
    ...(params.seed !== undefined && { seed: params.seed }),
    ...(params.referenceImages?.length && { referenceImages: params.referenceImages }),
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
