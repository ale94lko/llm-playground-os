import type { PromptVariables } from '~/types/llm'

export function detectVariables(systemPrompt: string, userPrompt: string): string[] {
  const text = `${systemPrompt}\n${userPrompt}`
  const matches = text.match(/\{\{(\w+)\}\}/g) ?? []
  return [...new Set(matches.map(m => m.slice(2, -2)))]
}

export function interpolateVariables(text: string, variables: PromptVariables): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => variables[name] ?? `{{${name}}}`)
}

export function syncVariableKeys(
  detected: string[],
  current: PromptVariables,
): PromptVariables {
  const next = { ...current }
  for (const name of detected) {
    if (!(name in next)) next[name] = ''
  }
  return next
}
