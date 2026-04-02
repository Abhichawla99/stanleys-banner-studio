// Google Imagen 4 via Gemini API

const PROXY = 'http://localhost:3001'

export interface Imagen4Params {
  prompt: string
  negativePrompt?: string
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
  sampleCount?: number
  apiKey: string
  referenceImages?: string[] // base64 data URLs — uses Gemini Flash Image when provided
}

export interface Imagen4Result {
  imageUrl: string
  mimeType: string
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  if (!dataUrl.startsWith('data:')) return null
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return null
  const mimeType = dataUrl.slice(5, comma).replace(';base64', '')
  return { mimeType, data: dataUrl.slice(comma + 1) }
}

// When reference images are provided, use Gemini Flash Image (multimodal editing)
async function generateWithReferences(params: Imagen4Params & { referenceImages: string[] }): Promise<Imagen4Result> {
  const imageParts = params.referenceImages.map(img => {
    const parsed = parseDataUrl(img)
    if (parsed) return { inlineData: { mimeType: parsed.mimeType, data: parsed.data } }
    return { fileData: { mimeType: 'image/jpeg', fileUri: img } }
  })

  const res = await fetch(`${PROXY}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Gemini-Key': params.apiKey },
    body: JSON.stringify({
      model: 'gemini-2.0-flash-preview-image-generation',
      contents: [{
        role: 'user',
        parts: [
          ...imageParts,
          { text: `Using these ${params.referenceImages.length} reference image(s) as visual context, generate a new image in the style of Imagen 4: ${params.prompt}` },
        ],
      }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini image edit API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const imgPart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))
  if (!imgPart) throw new Error('No image returned')
  const mimeType = imgPart.inlineData.mimeType
  return { imageUrl: `data:${mimeType};base64,${imgPart.inlineData.data}`, mimeType }
}

export async function generateImagen4(params: Imagen4Params): Promise<Imagen4Result> {
  if (params.referenceImages && params.referenceImages.length > 0) {
    return generateWithReferences(params as Imagen4Params & { referenceImages: string[] })
  }

  const res = await fetch(`${PROXY}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Gemini-Key': params.apiKey },
    body: JSON.stringify({
      model: 'imagen-4.0-generate-preview-05-20',
      action: 'predict',
      instances: [{ prompt: params.prompt }],
      parameters: {
        sampleCount: params.sampleCount ?? 1,
        aspectRatio: params.aspectRatio ?? '1:1',
        ...(params.negativePrompt ? { negativePrompt: params.negativePrompt } : {}),
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Imagen 4 API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const prediction = data?.predictions?.[0]
  if (!prediction) throw new Error('No prediction returned from Imagen 4')

  const b64 = prediction.bytesBase64Encoded
  const mimeType = prediction.mimeType ?? 'image/png'
  if (!b64) throw new Error('No image data in Imagen 4 response')
  return { imageUrl: `data:${mimeType};base64,${b64}`, mimeType }
}
