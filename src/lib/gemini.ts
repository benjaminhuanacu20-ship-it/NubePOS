const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY?.trim() ?? ''
const PLACEHOLDER = /^TU[-_]|your[-_]|^<|>$|AIza\.\.\.$/i

/**
 * Free tier: gemini-3.6-flash suele tener solo ~5 RPM.
 * Preferimos 2.5-flash / flash-lite, con mejor margen en cuota gratis.
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
export const GEMINI_MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
] as const

const configured = import.meta.env.VITE_GEMINI_MODEL?.trim()
export const geminiModel =
  configured && !/1\.5/.test(configured) ? configured : DEFAULT_GEMINI_MODEL

export const isGeminiConfigured = geminiApiKey !== '' && !PLACEHOLDER.test(geminiApiKey)
export { geminiApiKey }

export function formatGeminiError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)

  if (/429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(text)) {
    const retry = text.match(/retry in ([\d.]+)\s*s/i)?.[1]
    const seconds = retry ? Math.ceil(Number(retry)) : 30
    return `Cuota gratis de Gemini agotada (límite por minuto). Espera ~${seconds}s y vuelve a pulsar "Analizar negocio". Si lo usas mucho, crea otra API key o activa billing en Google AI Studio.`
  }

  if (/NOT_FOUND|no longer available/i.test(text)) {
    return 'Ese modelo de Gemini ya no está disponible. Reinicia npm run dev o cambia VITE_GEMINI_MODEL.'
  }

  // Intenta sacar solo el message del JSON de Google
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } }
    if (parsed.error?.message) return formatGeminiError(new Error(parsed.error.message))
  } catch {
    /* plain text */
  }

  return text.length > 280 ? `${text.slice(0, 280)}…` : text
}
