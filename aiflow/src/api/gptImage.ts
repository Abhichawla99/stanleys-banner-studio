// GPT Image 1 via OpenAI Images API — routed through local proxy

const PROXY = 'http://localhost:3001'

export interface GPTImageParams {
  prompt: string
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto'
  quality?: 'low' | 'medium' | 'high'
  background?: 'transparent' | 'opaque' | 'auto'
  apiKey: string
  referenceImages?: string[] // base64 data URLs — first one used as edit base
}

export interface GPTImageResult {
  imageUrl: string
}

export async function generateGPTImage(params: GPTImageParams): Promise<GPTImageResult> {
  const refs = (params.referenceImages ?? []).filter(r => r.startsWith('data:'))

  // When reference images provided, use the edits endpoint
  if (refs.length > 0) {
    const res = await fetch(`${PROXY}/api/openai/images/edits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-OpenAI-Key': params.apiKey },
      body: JSON.stringify({
        prompt: params.prompt,
        size: params.size && params.size !== 'auto' ? params.size : '1024x1024',
        quality: params.quality ?? 'high',
        images: refs,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI Images Edit API error ${res.status}: ${err}`)
    }
    const data = await res.json()
    const b64 = data?.data?.[0]?.b64_json
    if (!b64) throw new Error('No image data in OpenAI edit response')
    return { imageUrl: `data:image/png;base64,${b64}` }
  }

  // Standard generation
  const body: Record<string, unknown> = {
    model: 'gpt-image-1',
    prompt: params.prompt,
    n: 1,
    size: params.size ?? '1024x1024',
    quality: params.quality ?? 'high',
    output_format: 'b64_json',
  }
  if (params.background && params.background !== 'auto') {
    body.background = params.background
  }

  const res = await fetch(`${PROXY}/api/openai/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-OpenAI-Key': params.apiKey },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI Images API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const b64 = data?.data?.[0]?.b64_json
  if (!b64) throw new Error('No image data in OpenAI response')
  return { imageUrl: `data:image/png;base64,${b64}` }
}
