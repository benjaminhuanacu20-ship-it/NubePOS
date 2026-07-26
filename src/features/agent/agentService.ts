import { GoogleGenAI, type Content, type Part } from '@google/genai'
import {
  GEMINI_MODEL_FALLBACKS,
  formatGeminiError,
  geminiApiKey,
  geminiModel,
  isGeminiConfigured,
} from '@/lib/gemini'
import { SYSTEM_PROMPT } from '@/features/agent/prompt'
import { createToolExecutor, toolDeclarations, type AgentContext } from '@/features/agent/tools'

/** Free tier ~5 RPM: hay que terminar en pocos turnos. */
const MAX_TURNS = 4
const MAX_RATE_RETRIES = 2

export interface AgentRun {
  summary: string
  steps: string[]
}

export type AgentProgress = (message: string) => void

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isModelUnavailableError(error: unknown) {
  return /NOT_FOUND|no longer available|not found|unsupported|404/i.test(errorText(error))
}

function isRateLimitError(error: unknown) {
  return /429|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(errorText(error))
}

function retryDelayMs(error: unknown) {
  const match = errorText(error).match(/retry in ([\d.]+)\s*s/i)
  const seconds = match ? Number(match[1]) : 25
  return Math.min(Math.max(Math.ceil(seconds * 1000) + 500, 5000), 60000)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function modelCandidates(preferred: string) {
  return [...new Set([preferred, ...GEMINI_MODEL_FALLBACKS])]
}

async function generateOnce(ai: GoogleGenAI, model: string, contents: Content[]) {
  return ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: toolDeclarations }],
      temperature: 0.2,
    },
  })
}

async function generateWithResilience(
  ai: GoogleGenAI,
  contents: Content[],
  preferredModel: string,
  onProgress?: AgentProgress,
) {
  const models = modelCandidates(preferredModel)
  let lastError: unknown

  for (let attempt = 0; attempt <= MAX_RATE_RETRIES; attempt++) {
    for (const model of models) {
      try {
        const response = await generateOnce(ai, model, contents)
        return { model, response }
      } catch (error) {
        lastError = error

        if (isModelUnavailableError(error)) {
          onProgress?.(`Modelo ${model} no disponible, probando otro…`)
          continue
        }

        if (isRateLimitError(error)) {
          // Misma cuota del modelo: probar el siguiente bucket antes de esperar.
          onProgress?.(`Cuota de ${model} llena, probando otro modelo…`)
          continue
        }

        throw new Error(formatGeminiError(error))
      }
    }

    if (attempt < MAX_RATE_RETRIES && isRateLimitError(lastError)) {
      const waitMs = retryDelayMs(lastError)
      onProgress?.(`Cuota Gemini agotada. Reintentando en ${Math.ceil(waitMs / 1000)}s…`)
      await sleep(waitMs)
      continue
    }

    break
  }

  throw new Error(formatGeminiError(lastError ?? new Error('Error de Gemini')))
}

/**
 * Bucle de function calling: el modelo pide herramientas, las ejecutamos contra
 * Supabase y le devolvemos el resultado hasta que produce el resumen final.
 */
export async function runBusinessAnalysis(
  ctx: AgentContext,
  onProgress?: AgentProgress,
): Promise<AgentRun> {
  if (!isGeminiConfigured) {
    throw new Error(
      'Falta VITE_GEMINI_API_KEY en el archivo .env. Consigue una gratis en https://aistudio.google.com/apikey',
    )
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey })
  const execute = createToolExecutor(ctx)

  const contents: Content[] = [
    {
      role: 'user',
      parts: [
        {
          text: 'Analiza el negocio ahora. En el PRIMER turno llama a getInventory, getSales y getCustomers juntas. En el SEGUNDO turno crea las alertas y exactamente 3 recomendaciones. Luego entrega el resumen final. Minimiza turnos.',
        },
      ],
    },
  ]

  const steps: string[] = []
  let summary = ''
  let activeModel = geminiModel

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    onProgress?.(turn === 0 ? 'Consultando Gemini…' : `Turno ${turn + 1}/${MAX_TURNS}…`)

    const { model, response } = await generateWithResilience(ai, contents, activeModel, onProgress)
    activeModel = model

    const modelParts = response.candidates?.[0]?.content?.parts ?? []
    if (modelParts.length > 0) {
      contents.push({ role: 'model', parts: modelParts })
    }

    const calls = response.functionCalls ?? []

    if (calls.length === 0) {
      summary = response.text?.trim() ?? ''
      break
    }

    const responseParts: Part[] = []

    for (const call of calls) {
      const name = call.name ?? ''
      const args = (call.args ?? {}) as Record<string, unknown>

      try {
        const result = await execute(name, args)
        steps.push(result.label)
        responseParts.push({
          functionResponse: { name, response: { result: result.data } },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'error desconocido'
        steps.push(`Error en ${name}: ${message}`)
        responseParts.push({
          functionResponse: { name, response: { error: message } },
        })
      }
    }

    contents.push({ role: 'user', parts: responseParts })
  }

  return {
    summary: summary || 'Análisis completado. Revisa las alertas y recomendaciones generadas.',
    steps,
  }
}
