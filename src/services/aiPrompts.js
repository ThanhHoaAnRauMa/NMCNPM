export function buildSummaryPrompt({ conversationId, messages }) {
  const transcript = messages
    .map((message, index) => {
      const sender = message.senderId || 'unknown'
      const timestamp = message.timestamp || 'unknown-time'
      return `[${index + 1}] messageId=${message.messageId} sender=${sender} time=${timestamp}\n${message.text}`
    })
    .join('\n\n')

  return [
    'You summarize opt-in decrypted chat messages for Secure Chat Forensics.',
    'Use only the provided messages. Do not invent facts, identities, or legal conclusions.',
    'Return a concise summary in the same main language as the messages.',
    'Include important topics, decisions, action items, and notable risk signals if present.',
    `Conversation ID: ${conversationId}`,
    'Messages:',
    transcript,
  ].join('\n\n')
}

export function buildModerationPrompt(text) {
  return [
    'You are a content moderation classifier for a secure chat application.',
    'Classify whether the message should be blocked before encryption.',
    'Return only valid JSON with this exact shape:',
    '{"harmful": boolean, "categories": string[], "warning": string}',
    'Use categories such as harassment, hate, sexual, self_harm, violence, illegal, privacy_leak, scam, spam.',
    'If the message is allowed, set harmful=false, categories=[], warning="".',
    'Message:',
    text,
  ].join('\n\n')
}

export function parseModerationJson(rawText) {
  const text = String(rawText || '').trim()
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('moderation response did not contain JSON')

  const parsed = JSON.parse(match[0])
  return {
    harmful: Boolean(parsed.harmful),
    categories: Array.isArray(parsed.categories)
      ? parsed.categories.filter((category) => typeof category === 'string').slice(0, 10)
      : [],
    warning: typeof parsed.warning === 'string' ? parsed.warning : '',
  }
}
