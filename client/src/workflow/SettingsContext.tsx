import { createContext, useContext, useState, type ReactNode } from 'react'

interface Settings {
  geminiApiKey: string
  falApiKey: string
  openAiApiKey: string
  klingApiKey: string
  klingApiSecret: string
}

interface SettingsCtx extends Settings {
  update: (key: keyof Settings, value: string) => void
}

const Ctx = createContext<SettingsCtx>({
  geminiApiKey: '',
  falApiKey: '',
  openAiApiKey: '',
  klingApiKey: '',
  klingApiSecret: '',
  update: () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const load = (k: string) => localStorage.getItem(k) ?? ''
  const [geminiApiKey, setGemini] = useState(() => load('aiflow_gemini'))
  const [falApiKey, setFal] = useState(() => load('aiflow_fal'))
  const [openAiApiKey, setOpenAi] = useState(() => load('aiflow_openai'))
  const [klingApiKey, setKlingKey] = useState(() => load('aiflow_kling_key'))
  const [klingApiSecret, setKlingSecret] = useState(() => load('aiflow_kling_secret'))

  const setters: Record<keyof Settings, (v: string) => void> = {
    geminiApiKey: (v) => { setGemini(v); localStorage.setItem('aiflow_gemini', v) },
    falApiKey: (v) => { setFal(v); localStorage.setItem('aiflow_fal', v) },
    openAiApiKey: (v) => { setOpenAi(v); localStorage.setItem('aiflow_openai', v) },
    klingApiKey: (v) => { setKlingKey(v); localStorage.setItem('aiflow_kling_key', v) },
    klingApiSecret: (v) => { setKlingSecret(v); localStorage.setItem('aiflow_kling_secret', v) },
  }

  return (
    <Ctx.Provider value={{
      geminiApiKey, falApiKey, openAiApiKey, klingApiKey, klingApiSecret,
      update: (k, v) => setters[k](v),
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSettings = () => useContext(Ctx)
