// Google Veo 3.1 Video Generation — routed through local proxy

const PROXY = 'http://localhost:3001'

export interface VeoParams {
  prompt: string
  negativePrompt?: string
  aspectRatio?: '16:9' | '9:16'
  durationSeconds?: 4 | 6 | 8
  resolution?: '720p' | '1080p'
  generateAudio?: boolean
  seed?: number
  apiKey: string
  model?: 'veo-3.1-generate-preview' | 'veo-3.0-generate-preview'
}

export interface VeoResult {
  operationName: string
  videoUrl?: string
  status: 'pending' | 'done' | 'failed'
}

export async function createVeoTask(params: VeoParams): Promise<VeoResult> {
  const model = params.model ?? 'veo-3.1-generate-preview'

  const res = await fetch(`${PROXY}/api/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Gemini-Key': params.apiKey },
    body: JSON.stringify({
      model,
      action: 'generateVideos',
      contents: [{ parts: [{ text: params.prompt }] }],
      generationConfig: {
        aspectRatio: params.aspectRatio ?? '16:9',
        durationSeconds: params.durationSeconds ?? 8,
        sampleCount: 1,
        generateAudio: params.generateAudio ?? false,
        ...(params.negativePrompt && { negativePrompt: params.negativePrompt }),
        ...(params.resolution && { resolution: params.resolution }),
        ...(params.seed !== undefined && { seed: params.seed }),
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Veo API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return { operationName: data.name, status: 'pending' }
}

export async function pollVeoOperation(operationName: string, apiKey: string): Promise<VeoResult> {
  const res = await fetch(
    `${PROXY}/api/gemini/operation?name=${encodeURIComponent(operationName)}`,
    { headers: { 'X-Gemini-Key': apiKey } },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Veo poll error ${res.status}: ${err}`)
  }

  const data = await res.json()
  if (!data.done) return { operationName, status: 'pending' }
  if (data.error) throw new Error(`Veo generation failed: ${data.error.message}`)

  const videoResponse = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video
  let videoUrl: string | undefined
  if (videoResponse?.uri) videoUrl = videoResponse.uri
  else if (videoResponse?.videoData) videoUrl = `data:video/mp4;base64,${videoResponse.videoData}`

  return { operationName, status: 'done', videoUrl }
}
