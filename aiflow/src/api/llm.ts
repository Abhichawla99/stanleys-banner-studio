const PROXY = 'http://localhost:3001'

export interface LLMParams {
  provider: 'gemini' | 'openai'
  model: string
  systemPrompt: string
  userPrompt: string
  apiKey: string
  temperature?: number
}

export async function callLLM(params: LLMParams): Promise<string> {
  const { provider, model, systemPrompt, userPrompt, apiKey, temperature = 0.8 } = params

  if (provider === 'gemini') {
    const body: Record<string, unknown> = {
      model,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature, maxOutputTokens: 4096 },
    }
    if (systemPrompt.trim()) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] }
    }
    const res = await fetch(`${PROXY}/api/gemini`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Gemini-Key': apiKey },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as any)?.error?.message ?? (err as any)?.error ?? `Gemini error ${res.status}`)
    }
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  }

  if (provider === 'openai') {
    const res = await fetch(`${PROXY}/api/openai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-OpenAI-Key': apiKey },
      body: JSON.stringify({
        model,
        messages: [
          ...(systemPrompt.trim() ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: 4096,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as any)?.error?.message ?? `OpenAI error ${res.status}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  }

  throw new Error(`Unknown provider: ${provider}`)
}
