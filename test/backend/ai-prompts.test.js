import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSummaryPrompt } from '../../src/services/aiPrompts.js'

test('summary prompt emphasizes the conversation and hides database identifiers', () => {
  const prompt = buildSummaryPrompt({
    conversationId: 'ignored-conversation-id',
    messages: [
      {
        messageId: 'ignored-message-id',
        senderId: 'ignored-sender-id',
        senderLabel: 'test1',
        timestamp: '2026-06-22T10:00:00.000Z',
        text: 'tao là siêu nhân',
      },
    ],
  })

  assert.match(prompt, /test1/)
  assert.match(prompt, /tao là siêu nhân/)
  assert.match(prompt, /preserve its tone and central joke/)
  assert.doesNotMatch(prompt, /ignored-conversation-id|ignored-message-id|ignored-sender-id/)
})

