import assert from 'node:assert/strict'
import test from 'node:test'

import { generateGeminiText } from '../../src/services/geminiClient.js'

test('Gemini text generation disables thinking so output tokens remain available', async () => {
  let requestBody
  const text = await generateGeminiText('summarize this', {
    apiKey: 'test-api-key',
    model: 'gemini-test',
    async fetchImpl(_url, options) {
      requestBody = JSON.parse(options.body)
      return {
        ok: true,
        async json() {
          return { candidates: [{ content: { parts: [{ text: 'Complete summary' }] }, finishReason: 'STOP' }] }
        },
      }
    },
  })

  assert.equal(text, 'Complete summary')
  assert.equal(requestBody.generationConfig.thinkingConfig.thinkingBudget, 0)
  assert.equal(requestBody.generationConfig.maxOutputTokens, 768)
})

test('Gemini text generation rejects truncated responses', async () => {
  await assert.rejects(
    generateGeminiText('summarize this', {
      apiKey: 'test-api-key',
      async fetchImpl() {
        return {
          ok: true,
          async json() {
            return { candidates: [{ content: { parts: [{ text: 'Partial' }] }, finishReason: 'MAX_TOKENS' }] }
          },
        }
      },
    }),
    (error) => error.code === 'AI_TRUNCATED_RESPONSE',
  )
})

test('Gemini text generation retries temporary provider unavailability', async () => {
  let attempts = 0
  const text = await generateGeminiText('summarize this', {
    apiKey: 'test-api-key',
    retries: 1,
    async fetchImpl() {
      attempts += 1
      if (attempts === 1) {
        return {
          ok: false,
          status: 503,
          headers: new Map(),
          async json() {
            return { error: { status: 'UNAVAILABLE', message: 'high demand' } }
          },
        }
      }
      return {
        ok: true,
        async json() {
          return { candidates: [{ content: { parts: [{ text: 'Recovered summary' }] }, finishReason: 'STOP' }] }
        },
      }
    },
  })

  assert.equal(attempts, 2)
  assert.equal(text, 'Recovered summary')
})
