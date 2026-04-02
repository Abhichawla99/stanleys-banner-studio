// Kling AI Video Generation — JWT signing handled server-side via proxy

const PROXY = 'http://localhost:3001'

export interface KlingParams {
  prompt: string
  negativePrompt?: string
  model?: string
  duration?: 5 | 10
  aspectRatio?: '16:9' | '9:16' | '1:1'
  cfgScale?: number
  imageUrl?: string // for image-to-video
  apiKey: string   // Access Key (sent as fallback header)
  apiSecret: string // Secret Key (sent as fallback header)
}

export interface KlingResult {
  taskId: string
  videoUrl?: string
  status: 'submitted' | 'processing' | 'succeed' | 'failed'
}

export async function createKlingTask(params: KlingParams): Promise<KlingResult> {
  const body: Record<string, unknown> = {
    type: params.imageUrl ? 'image2video' : 'text2video',
    model_name: params.model ?? 'kling-v2-master',
    prompt: params.prompt,
    ...(params.negativePrompt && { negative_prompt: params.negativePrompt }),
    cfg_scale: params.cfgScale ?? 0.5,
    duration: String(params.duration ?? 5),
    aspect_ratio: params.aspectRatio ?? '16:9',
    ...(params.imageUrl && { image_url: params.imageUrl }),
  }

  const res = await fetch(`${PROXY}/api/kling/task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Kling-Key': params.apiKey,
      'X-Kling-Secret': params.apiSecret,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Kling API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  if (data.code !== undefined && data.code !== 0) throw new Error(`Kling error: ${data.message}`)

  return { taskId: data.data.task_id, status: 'submitted' }
}

export async function pollKlingTask(taskId: string, accessKey: string, secretKey: string): Promise<KlingResult> {
  const res = await fetch(`${PROXY}/api/kling/task/${taskId}`, {
    headers: { 'X-Kling-Key': accessKey, 'X-Kling-Secret': secretKey },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Kling poll error ${res.status}: ${err}`)
  }

  const data = await res.json()
  if (data.code !== undefined && data.code !== 0) throw new Error(`Kling error: ${data.message}`)

  const task = data.data
  const status = task.task_status as KlingResult['status']
  const videoUrl = task.task_result?.videos?.[0]?.url

  return { taskId, status, videoUrl }
}
