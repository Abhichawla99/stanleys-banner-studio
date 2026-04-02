// Generic fal.ai image generation — routed through local proxy with base64 conversion

const PROXY = 'http://localhost:3001'

export interface FalImageParams {
  modelId: string
  prompt: string
  negativePrompt?: string
  imageSize?: string  // e.g. "landscape_16_9", "square_hd", "portrait_4_3"
  numSteps?: number
  seed?: number
  apiKey: string
  referenceImages?: string[] // URLs or base64 — all converted to base64 server-side
  // Model-specific extras
  extra?: Record<string, unknown>
}

export interface FalImageResult {
  imageUrl: string
}

export async function generateFalImage(params: FalImageParams): Promise<FalImageResult> {
  const body: Record<string, unknown> = {
    modelId: params.modelId,
    prompt: params.prompt,
    ...(params.negativePrompt && { negative_prompt: params.negativePrompt }),
    ...(params.imageSize && { image_size: params.imageSize }),
    ...(params.numSteps && { num_inference_steps: params.numSteps }),
    ...(params.seed !== undefined && { seed: params.seed }),
    ...(params.extra ?? {}),
    // Pass all reference images — server converts URLs to base64 and handles CORS
    ...(params.referenceImages?.length && { referenceImages: params.referenceImages }),
  }

  const res = await fetch(`${PROXY}/api/fal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Fal-Key': params.apiKey },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let msg = `fal.ai error ${res.status}`
    try { msg = JSON.parse(text)?.detail ?? JSON.parse(text)?.error ?? msg } catch {}
    throw new Error(msg)
  }

  const data = await res.json()
  const imageUrl =
    data?.images?.[0]?.url ??
    data?.image?.url ??
    data?.output?.images?.[0]?.url ??
    null

  if (!imageUrl) throw new Error('No image URL in response. Check model ID.')
  return { imageUrl }
}

// Describe an image using Gemini Vision
export async function describeImage(imageUrl: string, apiKey: string, prompt = 'Describe this image in detail for use as an AI image generation prompt.'): Promise<string> {
  let inlineData: { mimeType: string; data: string } | null = null
  let imageUri: string | null = null

  if (imageUrl.startsWith('data:')) {
    const [header, b64] = imageUrl.split(',')
    const mimeType = header.replace('data:', '').replace(';base64', '')
    inlineData = { mimeType, data: b64 }
  } else {
    imageUri = imageUrl
  }

  const part = inlineData
    ? { inlineData }
    : { fileData: { mimeType: 'image/jpeg', fileUri: imageUri } }

  const res = await fetch(`${PROXY}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Gemini-Key': apiKey },
    body: JSON.stringify({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [part, { text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini Vision error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}
