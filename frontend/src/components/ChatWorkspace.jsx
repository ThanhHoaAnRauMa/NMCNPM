import { useEffect, useMemo, useRef, useState } from 'react'
import KycBadge from './KycBadge.jsx'
import { decryptFile, decryptText, encryptFile, encryptText, verifyPayload } from '../lib/crypto.js'
import { roomIdForConversation } from '../lib/evidence.js'
import { conversationPeer, conversationTitle, displayName, fileSize, shortTime, userId } from '../lib/format.js'
import { containsSubstring, fetchAllConversationMessages, highlightSubstring } from '../lib/localMessageSearch.js'

function uniqueMessages(messages) {
  const seen = new Set()
  return messages.filter((message) => {
    const key = message._id || message.tempId
    if (!key || seen.has(String(key))) return false
    seen.add(String(key))
    return true
  })
}

const MESSAGE_CACHE_LIMIT = 200
const messageMemory = new Map()
const QUICK_ICONS = ['👍', '😂', '🔥', '❤️', '✅', '🎉']
const ATTACHMENT_OPTIONS = [
  { id: 'image', icon: '🖼', label: 'Ảnh', accept: 'image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif' },
  { id: 'video', icon: '▶', label: 'Video', accept: 'video/mp4,video/webm,video/quicktime,video/x-matroska' },
  { id: 'pdf', icon: 'PDF', label: 'PDF', accept: 'application/pdf' },
  { id: 'file', icon: '＋', label: 'File', accept: 'image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv' },
]

function fileKind(message) {
  const mime = String(message.fileMime || '').toLowerCase()
  const name = String(message.fileName || '').toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (mime.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) return 'doc'
  if (mime.includes('sheet') || mime.includes('excel') || name.endsWith('.xls') || name.endsWith('.xlsx')) return 'sheet'
  return 'file'
}

function fileIcon(message) {
  return {
    image: 'IMG',
    video: 'VID',
    audio: 'AUD',
    pdf: 'PDF',
    doc: 'DOC',
    sheet: 'XLS',
    file: 'FILE',
  }[fileKind(message)] || 'FILE'
}

function canPreviewFile(message) {
  return ['image', 'video', 'audio', 'pdf'].includes(fileKind(message))
}

function persistedMessageId(message) {
  const id = String(message?._id || '')
  return /^[a-f0-9]{24}$/i.test(id) ? id.toLowerCase() : null
}

function objectIdTime(id) {
  return Number.parseInt(id.slice(0, 8), 16) * 1000
}

function messageTime(message) {
  const persistedId = persistedMessageId(message)
  if (persistedId) return objectIdTime(persistedId)
  const value = new Date(message.createdAt || message.timestamp || 0).getTime()
  return Number.isNaN(value) ? 0 : value
}

function normalizeMessages(messages) {
  return uniqueMessages(messages).sort((left, right) => {
    const timeDiff = messageTime(left) - messageTime(right)
    if (timeDiff) return timeDiff
    const leftPersistedId = persistedMessageId(left)
    const rightPersistedId = persistedMessageId(right)
    if (leftPersistedId && rightPersistedId) return leftPersistedId.localeCompare(rightPersistedId)
    return String(left.tempId || left._id || '').localeCompare(String(right.tempId || right._id || ''))
  })
}

function readMessageCache(cacheKey) {
  return cacheKey ? [...(messageMemory.get(cacheKey) || [])] : []
}

function writeMessageCache(cacheKey, messages) {
  if (cacheKey) messageMemory.set(cacheKey, normalizeMessages(messages).slice(-MESSAGE_CACHE_LIMIT))
}

function HighlightedText({ value = '', keyword = '' }) {
  return highlightSubstring(value, keyword).map((part, index) => part.match
    ? <mark className="rounded bg-amber/30 px-0.5 text-paper" key={index}>{part.text}</mark>
    : <span key={index}>{part.text}</span>)
}

export default function ChatWorkspace({ api, socket, conversation, currentUser, identity, keyStatus, notify, onConversationActivity, onKeyMismatch }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [typingUsers, setTypingUsers] = useState([])
  const [panel, setPanel] = useState(null)
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchedKeyword, setSearchedKeyword] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchStats, setSearchStats] = useState(null)
  const [focusedMessageId, setFocusedMessageId] = useState(null)
  const pendingPlaintext = useRef(new Map())
  const typingTimer = useRef(null)
  const fileInput = useRef(null)
  const searchRun = useRef(0)
  const currentUserId = currentUser.id || currentUser._id
  const isPrivacy = ['PRIVACY', 'Privacy'].includes(conversation?.mode)
  const cacheKey = currentUserId && conversation?._id ? `${currentUserId}:${conversation._id}` : null

  const members = useMemo(() => conversation?.members || [], [conversation])
  const memberById = useMemo(() => new Map(members.map((member) => [userId(member), member])), [members])

  const recipients = useMemo(() => members.map((member) => ({ userId: userId(member), publicKey: member.publicKey })).filter((member) => member.userId && member.publicKey), [members])

  const hydrateMessage = async (message) => {
    const sender = typeof message.senderId === 'object' ? message.senderId : memberById.get(userId(message.senderId))
    let text = message.msgType === 'FILE' ? 'Tệp đính kèm đã mã hóa' : 'Không thể giải mã trên thiết bị này'
    let decrypted = false
    let verified = null
    if (identity && message.encryptedContent) {
      try {
        if (message.msgType !== 'FILE') text = await decryptText(message.encryptedContent, currentUserId, identity)
        decrypted = true
      } catch (_error) {
        const pending = pendingPlaintext.current.get(message.tempId)
        if (pending) {
          text = pending
          decrypted = true
        }
      }
      const verificationKey = message.senderPublicKey || sender?.publicKey
      if (verificationKey && message.signature) {
        verified = await verifyPayload(message.encryptedContent, message.signature, verificationKey)
      }
    }
    return { ...message, senderId: sender || message.senderId, text, decrypted, verified }
  }

  const updateMessages = (updater) => {
    setMessages((current) => {
      const next = normalizeMessages(typeof updater === 'function' ? updater(current) : updater)
      writeMessageCache(cacheKey, next)
      return next
    })
  }

  useEffect(() => {
    let active = true
    const activeCacheKey = currentUserId && conversation?._id ? `${currentUserId}:${conversation._id}` : null
    const cachedMessages = readMessageCache(activeCacheKey)
    setMessages(cachedMessages)
    setError('')
    setSummary(null)
    setSummaryLoading(false)
    setSearchLoading(false)
    setSearchedKeyword('')
    setSearchResults([])
    setSearchStats(null)
    setPanel(null)
    searchRun.current += 1
    if (!conversation?._id) return () => { active = false }

    setLoading(true)
    api.get(`/chat/${conversation._id}/messages?limit=50`)
      .then(async (payload) => {
        const hydrated = await Promise.all(payload.messages.map(hydrateMessage))
        if (active) {
          const merged = normalizeMessages([...cachedMessages, ...hydrated])
          writeMessageCache(activeCacheKey, merged)
          setMessages(merged)
        }
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))

    const onMessage = async (message) => {
      if (String(message.conversationId) !== String(conversation._id)) return
      const hydrated = await hydrateMessage(message)
      if (!active) return
      updateMessages((current) => uniqueMessages([...current.filter((item) => item.tempId !== message.tempId || item._id), hydrated]))
      onConversationActivity?.(message.conversationId, hydrated)
      const plaintext = pendingPlaintext.current.get(message.tempId)
      if (plaintext) pendingPlaintext.current.delete(message.tempId)
    }
    const onPrivateMessage = async (message) => {
      if (String(message.conversationId) !== String(conversation._id)) return
      await onMessage({
        ...message,
        _id: message._id || message.messageId || message.tempId,
        msgType: message.msgType || 'TEXT',
        status: message.status || 'SENT',
      })
      socket.emit('ack_private_message', { tempId: message.tempId })
    }
    const onStatus = ({ messageId, status }) => updateMessages((current) => current.map((message) => String(message._id) === String(messageId) ? { ...message, status } : message))
    const onPrivateSent = ({ tempId, messageId, conversationId, createdAt }) => {
      if (String(conversationId) !== String(conversation._id)) return
      updateMessages((current) => current.map((message) => {
        if (String(message.tempId) !== String(tempId)) return message
        return { ...message, _id: messageId || message._id, createdAt: createdAt || message.createdAt, timestamp: createdAt || message.timestamp, status: 'SENT' }
      }))
      onConversationActivity?.(conversationId, { _id: messageId || tempId, tempId, conversationId, senderId: currentUser, msgType: 'TEXT', status: 'SENT', createdAt, timestamp: createdAt })
    }
    const onTyping = ({ userId: typingUserId, conversationId }) => {
      if (String(conversationId) === String(conversation._id) && typingUserId !== currentUserId) setTypingUsers((current) => [...new Set([...current, typingUserId])])
    }
    const onStopTyping = ({ userId: typingUserId }) => setTypingUsers((current) => current.filter((id) => id !== typingUserId))
    const onSocketError = (payload) => {
      if (payload.code === 'KEY_MISMATCH') onKeyMismatch?.()
      if (payload.tempId) pendingPlaintext.current.delete(payload.tempId)
      if (['send_message', 'send_private_message'].includes(payload.event)) setError(payload.message)
    }

    if (!socket) return () => { active = false }

    socket.on('new_message', onMessage)
    socket.on('new_private_message', onPrivateMessage)
    socket.on('private_message_sent', onPrivateSent)
    socket.on('message_status', onStatus)
    socket.on('user_typing', onTyping)
    socket.on('user_stop_typing', onStopTyping)
    socket.on('socket_error', onSocketError)
    socket.emit('join_conversation', { conversationId: conversation._id })

    return () => {
      active = false
      socket.emit('leave_conversation', { conversationId: conversation._id })
      socket.off('new_message', onMessage)
      socket.off('new_private_message', onPrivateMessage)
      socket.off('private_message_sent', onPrivateSent)
      socket.off('message_status', onStatus)
      socket.off('user_typing', onTyping)
      socket.off('user_stop_typing', onStopTyping)
      socket.off('socket_error', onSocketError)
    }
  // hydrateMessage intentionally follows the selected conversation snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, conversation?._id, socket, identity, currentUserId])

  const ensureReady = () => {
    if (!identity) throw new Error('Thiết bị chưa có khóa mã hóa.')
    if (keyStatus !== 'ready') throw new Error('Khóa thiết bị không khớp tài khoản. Mở Hồ sơ để restore hoặc đồng bộ trước khi gửi.')
    if (recipients.length !== members.length) throw new Error('Một hoặc nhiều thành viên chưa có public key.')
    if (!socket?.connected) throw new Error('Kết nối realtime chưa sẵn sàng.')
  }

  const send = async (event) => {
    event.preventDefault()
    const plaintext = draft.trim()
    if (!plaintext || sending) return
    setSending(true)
    setError('')
    try {
      ensureReady()
      const encrypted = await encryptText(plaintext, recipients, identity, { conversationId: conversation._id })
      const tempId = crypto.randomUUID()
      pendingPlaintext.current.set(tempId, plaintext)
      const payload = { conversationId: conversation._id, ...encrypted, msgType: 'TEXT', tempId }
      if (isPrivacy) {
        const optimisticAt = new Date().toISOString()
        updateMessages((current) => [...current, { _id: tempId, tempId, conversationId: conversation._id, senderId: currentUser, text: plaintext, decrypted: true, verified: true, msgType: 'TEXT', status: 'SENT', createdAt: optimisticAt, timestamp: optimisticAt }])
        onConversationActivity?.(conversation._id, { _id: tempId, tempId, conversationId: conversation._id, senderId: currentUser, msgType: 'TEXT', status: 'SENT', createdAt: optimisticAt, timestamp: optimisticAt })
        socket.emit('send_private_message', payload)
      } else {
        socket.emit('send_message', payload)
      }
      setDraft('')
      socket.emit('stop_typing', { conversationId: conversation._id })
    } catch (requestError) {
      const warning = requestError.payload?.moderation?.warning
      setError(warning || requestError.message)
    } finally {
      setSending(false)
    }
  }

  const updateDraft = (value) => {
    setDraft(value)
    if (!socket) return
    socket.emit('typing', { conversationId: conversation._id })
    clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => socket.emit('stop_typing', { conversationId: conversation._id }), 900)
  }

  const insertQuickIcon = (icon) => {
    const separator = draft && !draft.endsWith(' ') ? ' ' : ''
    updateDraft(`${draft}${separator}${icon} `)
  }

  const chooseAttachment = (accept) => {
    if (!fileInput.current) return
    fileInput.current.accept = accept
    fileInput.current.click()
  }

  const uploadFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setSending(true)
    setError('')
    try {
      ensureReady()
      const encrypted = await encryptFile(file, recipients, identity, { conversationId: conversation._id })
      const tempId = crypto.randomUUID()
      const formData = new FormData()
      formData.append('file', encrypted.blob, `${file.name}.enc`)
      formData.append('conversationId', conversation._id)
      formData.append('encryptedContent', encrypted.encryptedContent)
      formData.append('signature', encrypted.signature)
      formData.append('originalName', file.name)
      formData.append('originalMime', file.type || 'application/octet-stream')
      formData.append('tempId', tempId)
      const payload = await api.upload('/files/upload', formData)
      const hydrated = await hydrateMessage(payload.message)
      updateMessages((current) => uniqueMessages([...current, hydrated]))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  const openFile = async (message) => {
    setError('')
    try {
      if (!identity) throw new Error('Thiết bị không có khóa giải mã.')
      const response = await fetch(message.fileUrl)
      if (!response.ok) throw new Error('Không tải được encrypted blob.')
      const blob = await decryptFile(message.encryptedContent, await response.arrayBuffer(), currentUserId, identity)
      const url = URL.createObjectURL(blob)
      if (canPreviewFile(message)) {
        window.open(url, '_blank', 'noopener,noreferrer')
        setTimeout(() => URL.revokeObjectURL(url), 60000)
        return
      }
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = message.fileName || 'decrypted-file'
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (fileError) {
      setError(fileError.message)
    }
  }

  const runSearch = async (event) => {
    event.preventDefault()
    const keyword = searchKeyword.trim()
    if (!keyword) return setSearchResults([])
    const runId = ++searchRun.current
    setSearchedKeyword(keyword)
    setSearchLoading(true)
    setError('')
    try {
      const rawMessages = isPrivacy ? messages : await fetchAllConversationMessages(api, conversation._id)
      const hydrated = isPrivacy ? [...messages] : []
      if (!isPrivacy) {
        for (let index = 0; index < rawMessages.length; index += 50) {
          hydrated.push(...await Promise.all(rawMessages.slice(index, index + 50).map(hydrateMessage)))
          if (runId !== searchRun.current) return
        }
      }
      if (runId !== searchRun.current) return
      if (!isPrivacy) updateMessages(hydrated)
      const textMessages = hydrated.filter((message) => message.msgType !== 'FILE')
      const searchable = textMessages.filter((message) => message.decrypted)
      const results = searchable.filter((message) => containsSubstring(message.text, keyword)).reverse()
      setSearchResults(results)
      setSearchStats({ total: textMessages.length, searchable: searchable.length, unreadable: textMessages.length - searchable.length })
    } catch (requestError) {
      if (runId === searchRun.current) setError(requestError.message)
    } finally {
      if (runId === searchRun.current) setSearchLoading(false)
    }
  }

  const jumpToSearchResult = (messageId) => {
    const id = String(messageId)
    setFocusedMessageId(id)
    setPanel(null)
    window.setTimeout(() => {
      document.getElementById(`message-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    window.setTimeout(() => setFocusedMessageId((current) => current === id ? null : current), 2500)
  }

  const summarize = async () => {
    if (summaryLoading) return
    setError('')
    if (isPrivacy) {
      const message = 'Tính năng AI tóm tắt không khả dụng khi sử dụng chế độ Privacy.'
      setPanel('summary')
      setSummary({ summary: message, messageCount: 0, model: 'local-policy' })
      notify?.(message, { type: 'warning', title: 'AI tóm tắt' })
      return
    }
    const source = messages.filter((message) => /^[a-f0-9]{24}$/i.test(String(message._id)) && message.decrypted && message.msgType !== 'FILE').slice(-100)
    if (!source.length) {
      const message = 'Không có tin nhắn đã giải mã và lưu DB để tóm tắt.'
      setError(message)
      notify?.(message, { type: 'warning', title: 'AI tóm tắt' })
      return
    }
    setPanel('summary')
    setSummary(null)
    setSummaryLoading(true)
    try {
      const payload = await api.post('/ai/summarize', {
        conversationId: conversation._id,
        messageIds: source.map((message) => String(message._id)),
        messages: source.map((message) => ({ messageId: String(message._id), text: message.text })),
      })
      setSummary(payload)
    } catch (requestError) {
      setError(requestError.message)
      notify?.(requestError.message, { type: 'error', title: 'AI tóm tắt' })
    } finally {
      setSummaryLoading(false)
    }
  }

  if (!conversation) {
    return <div className="grid h-full place-items-center p-8 text-center"><div><p className="eyebrow">Encrypted workspace</p><h2 className="mt-4 font-display text-4xl">Chọn một hội thoại</h2><p className="mt-3 text-sm text-slate-500">Tin nhắn sẽ được giải mã cục bộ sau khi bạn chọn.</p></div></div>
  }

  const otherTyping = typingUsers.map((id) => displayName(memberById.get(id))).join(', ')
  const peer = conversationPeer(conversation, currentUserId)
  const currentRoomId = roomIdForConversation(conversation)
  const shortRoomId = currentRoomId ? `${currentRoomId.slice(0, 10)}...${currentRoomId.slice(-8)}` : 'Not available'
  const copyRoomId = async () => {
    if (!currentRoomId) return
    try {
      await navigator.clipboard.writeText(currentRoomId)
      setError('Đã copy Room ID.')
      notify?.('Đã copy Room ID.', { type: 'success' })
    } catch (_error) {
      const message = 'Không thể copy Room ID. Hãy mở Forensics để copy thủ công.'
      setError(message)
      notify?.(message, { type: 'error' })
    }
  }

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <h2 className="flex min-w-0 items-center gap-1.5 text-lg font-bold">
              <span className="truncate">{conversationTitle(conversation, currentUserId)}</span>
              <KycBadge user={peer} />
            </h2>
            <button className="mt-1 block max-w-full truncate font-mono text-[10px] text-slate-600 hover:text-mint" onClick={copyRoomId} title={currentRoomId} type="button">Room ID: {shortRoomId}</button>
            <p className="mt-1 text-[11px] text-slate-500">{members.length} thành viên · <span className={isPrivacy ? 'text-amber' : 'text-mint'}>{isPrivacy ? 'Privacy / persisted ciphertext' : 'KYC / persisted ciphertext'}</span></p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="btn-secondary" onClick={() => setPanel(panel === 'search' ? null : 'search')}>Tìm kiếm</button>
            <button className="btn-secondary" disabled={summaryLoading} onClick={summarize}>{summaryLoading ? 'Đang tóm tắt...' : 'AI tóm tắt'}</button>
          </div>
        </header>

        {error && <div className="mx-5 mt-3 flex items-start justify-between gap-3 rounded-xl border border-amber/25 bg-amber/10 px-4 py-3 text-xs text-amber sm:mx-7"><span>{error}</span><button onClick={() => setError('')}>×</button></div>}

        <div className="scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-6 sm:px-7">
          {loading && <p className="text-center text-xs text-slate-600">Đang tải ciphertext và giải mã...</p>}
          {!loading && messages.length === 0 && <div className="py-16 text-center"><p className="font-display text-2xl text-slate-300">Bắt đầu bằng một tin nhắn.</p><p className="mt-2 text-xs text-slate-600">Nội dung được mã hóa trước khi rời trình duyệt.</p></div>}
          {messages.map((message) => {
            const mine = userId(message.senderId) === currentUserId
            return (
              <article className={`flex rounded-2xl transition ${focusedMessageId === String(message._id || message.tempId) ? 'ring-2 ring-amber/70 ring-offset-4 ring-offset-ink' : ''} ${mine ? 'justify-end' : 'justify-start'}`} id={`message-${String(message._id || message.tempId)}`} key={String(message._id || message.tempId)}>
                <div className={`max-w-[82%] rounded-2xl border px-4 py-3 sm:max-w-[68%] ${mine ? 'border-mint/20 bg-mint/10' : 'border-line bg-white/[.035]'}`}>
                  {!mine && (
                    <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber">
                      <span>{displayName(message.senderId)}</span>
                      <KycBadge className="h-3.5 w-3.5" user={message.senderId} />
                    </p>
                  )}
                  {message.msgType === 'FILE' ? (
                    <button className="flex w-full items-center gap-3 text-left" onClick={() => openFile(message)}>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-[10px] font-bold text-mint">{fileIcon(message)}</span>
                      <span className="min-w-0"><strong className="block truncate text-sm">{message.fileName || 'Tệp mã hóa'}</strong><small className="text-slate-500">{fileSize(message.fileSizeBytes)} · {canPreviewFile(message) ? 'giải mã và mở xem' : 'giải mã khi tải'}</small></span>
                    </button>
                  ) : <p className={`whitespace-pre-wrap break-words text-sm leading-6 ${message.decrypted ? 'text-paper' : 'italic text-slate-500'}`}>{message.text}</p>}
                  <div className="mt-2 flex items-center justify-end gap-2 text-[9px] uppercase tracking-wider text-slate-600">
                    {message.verified === true && <span className="text-mint">signature ok</span>}
                    {message.verified === false && <span className="text-red-300">signature fail</span>}
                    <span>{shortTime(message.createdAt || message.timestamp)}</span>
                    {mine && <span>{message.status || 'SENT'}</span>}
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <div className="min-h-5 px-7 text-[10px] text-mint">{otherTyping ? `${otherTyping} đang nhập...` : ''}</div>
        <form className="border-t border-line p-4 sm:p-5" onSubmit={send}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {ATTACHMENT_OPTIONS.map((option) => (
                <button className="grid h-8 min-w-8 place-items-center rounded-lg border border-line px-2 text-[10px] font-bold text-slate-400 transition hover:border-mint/50 hover:text-mint disabled:opacity-40" disabled={sending || keyStatus !== 'ready'} key={option.id} onClick={() => chooseAttachment(option.accept)} title={`Gửi ${option.label} mã hóa`} type="button">
                  {option.icon}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ICONS.map((icon) => (
                <button className="grid h-8 w-8 place-items-center rounded-lg border border-line text-sm transition hover:border-amber/60 hover:bg-amber/10 disabled:opacity-40" disabled={sending || keyStatus !== 'ready'} key={icon} onClick={() => insertQuickIcon(icon)} title="Thêm icon vào tin nhắn" type="button">{icon}</button>
              ))}
            </div>
          </div>
          <div className="flex items-end gap-2 rounded-2xl border border-line bg-ink/70 p-2 focus-within:border-mint/60">
            <input ref={fileInput} className="hidden" type="file" onChange={uploadFile} />
            <textarea className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-600" maxLength={4000} placeholder={keyStatus === 'ready' ? 'Nhập tin nhắn...' : 'Đồng bộ khóa thiết bị để nhắn tin'} rows={1} value={draft} onChange={(event) => updateDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit() } }} />
            <button className="btn-primary h-10 shrink-0" disabled={!draft.trim() || sending || keyStatus !== 'ready'} type="submit">{sending ? '...' : 'Gửi'}</button>
          </div>
        </form>
      </section>

      {panel && (
        <aside className="scrollbar absolute inset-y-0 right-0 z-20 w-[min(90vw,360px)] overflow-y-auto border-l border-line bg-panel p-5 shadow-2xl lg:static lg:w-80 lg:shadow-none">
          <div className="flex items-center justify-between"><p className="eyebrow">{panel === 'search' ? 'Message search' : 'AI summary'}</p><button className="text-xl text-slate-500" onClick={() => setPanel(null)}>×</button></div>
          {panel === 'search' ? (
            <>
              <form className="mt-5 flex gap-2" onSubmit={runSearch}><input className="field" maxLength={200} placeholder="Nhập một phần nội dung" value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} /><button className="btn-primary" disabled={searchLoading || !searchKeyword.trim()} type="submit">{searchLoading ? '...' : 'Tìm'}</button></form>
              <p className="mt-3 text-[10px] leading-5 text-slate-500">Tìm substring trong toàn bộ tin nhắn giải mã được của hội thoại. Plaintext không được gửi lên máy chủ.</p>
              {searchStats && <p className="mt-3 text-xs text-slate-400"><strong className="text-paper">{searchResults.length}</strong> kết quả · {searchStats.searchable}/{searchStats.total} tin có thể tìm{searchStats.unreadable ? ` · ${searchStats.unreadable} tin không giải mã được` : ''}</p>}
              {!searchLoading && searchStats && searchResults.length === 0 && <p className="mt-8 text-center text-sm text-slate-500">Không tìm thấy tin nhắn chứa “{searchedKeyword}”.</p>}
              <div className="mt-5 space-y-3">{searchResults.map((result) => (
                <button className="w-full rounded-xl border border-line bg-ink/50 p-3 text-left transition hover:border-mint/40 hover:bg-white/[.04]" key={String(result._id || result.tempId)} onClick={() => jumpToSearchResult(result._id || result.tempId)} type="button">
                  <span className="flex items-center justify-between gap-3">
                    <strong className="min-w-0 flex items-center gap-1.5 text-xs text-amber">
                      <span className="truncate">{displayName(result.senderId)}</span>
                      <KycBadge className="h-3.5 w-3.5" user={result.senderId} />
                    </strong>
                    <small className="shrink-0 text-[10px] text-slate-600">{new Date(result.createdAt || result.timestamp).toLocaleString('vi-VN')}</small>
                  </span>
                  <span className="mt-2 block whitespace-pre-wrap break-words text-xs leading-5 text-slate-300"><HighlightedText keyword={searchedKeyword} value={result.text} /></span>
                </button>
              ))}</div>
            </>
          ) : (
            <div className="mt-5"><div className="rounded-xl border border-mint/20 bg-mint/5 p-4"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{summaryLoading ? 'Đang tạo tóm tắt, vui lòng chờ...' : summary?.summary || 'Chưa có tóm tắt.'}</p></div>{summary && <p className="mt-3 text-[10px] text-slate-600">{summary.messageCount} tin nhắn · {summary.cached ? 'cache' : summary.model}</p>}<p className="mt-5 text-[10px] leading-5 text-amber">Plaintext của các tin đã chọn được gửi tới Gemini khi bạn bấm tóm tắt; nguồn plaintext không được lưu trong Message.</p></div>
          )}
        </aside>
      )}
    </div>
  )
}
