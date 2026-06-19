import { useEffect, useMemo, useRef, useState } from 'react'
import { decryptFile, decryptText, encryptFile, encryptText, verifyPayload } from '../lib/crypto.js'
import { conversationTitle, displayName, fileSize, shortTime, userId } from '../lib/format.js'

function uniqueMessages(messages) {
  const seen = new Set()
  return messages.filter((message) => {
    const key = message._id || message.tempId
    if (!key || seen.has(String(key))) return false
    seen.add(String(key))
    return true
  })
}

function HighlightedSnippet({ value = '' }) {
  let highlighted = false
  return value.split(/(<\/?mark>)/i).map((part, index) => {
    if (/^<mark>$/i.test(part)) {
      highlighted = true
      return null
    }
    if (/^<\/mark>$/i.test(part)) {
      highlighted = false
      return null
    }
    return highlighted ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>
  })
}

export default function ChatWorkspace({ api, socket, conversation, currentUser, identity }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [typingUsers, setTypingUsers] = useState([])
  const [panel, setPanel] = useState(null)
  const [summary, setSummary] = useState(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [indexSearch, setIndexSearch] = useState(() => localStorage.getItem('secure-chat-index-search') === 'true')
  const pendingPlaintext = useRef(new Map())
  const typingTimer = useRef(null)
  const fileInput = useRef(null)
  const currentUserId = currentUser.id || currentUser._id
  const isPrivacy = ['PRIVACY', 'Privacy'].includes(conversation?.mode)

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
      if (sender?.publicKey && message.signature) {
        verified = await verifyPayload(message.encryptedContent, message.signature, sender.publicKey)
      }
    }
    return { ...message, senderId: sender || message.senderId, text, decrypted, verified }
  }

  useEffect(() => {
    let active = true
    setMessages([])
    setError('')
    setSummary(null)
    if (!conversation?._id) return () => { active = false }

    setLoading(true)
    api.get(`/chat/${conversation._id}/messages?limit=50`)
      .then(async (payload) => {
        const hydrated = await Promise.all(payload.messages.map(hydrateMessage))
        if (active) setMessages(hydrated)
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false))

    if (!socket) return () => { active = false }
    socket.emit('join_conversation', { conversationId: conversation._id })

    const onMessage = async (message) => {
      if (String(message.conversationId) !== String(conversation._id)) return
      const hydrated = await hydrateMessage(message)
      if (!active) return
      setMessages((current) => uniqueMessages([...current.filter((item) => item.tempId !== message.tempId || item._id), hydrated]))
      const plaintext = pendingPlaintext.current.get(message.tempId)
      if (plaintext && indexSearch && message._id && !isPrivacy) {
        api.post('/messages/index-snippet', {
          messageId: message._id,
          conversationId: conversation._id,
          senderId: currentUserId,
          snippet: plaintext.slice(0, 2000),
        }).catch(() => {})
      }
      if (plaintext) pendingPlaintext.current.delete(message.tempId)
    }
    const onPrivateMessage = async (message) => {
      if (String(message.conversationId) !== String(conversation._id)) return
      await onMessage({ ...message, _id: message.tempId, msgType: 'TEXT', status: 'SENT' })
      socket.emit('ack_private_message', { tempId: message.tempId })
    }
    const onStatus = ({ messageId, status }) => setMessages((current) => current.map((message) => String(message._id) === String(messageId) ? { ...message, status } : message))
    const onTyping = ({ userId: typingUserId, conversationId }) => {
      if (String(conversationId) === String(conversation._id) && typingUserId !== currentUserId) setTypingUsers((current) => [...new Set([...current, typingUserId])])
    }
    const onStopTyping = ({ userId: typingUserId }) => setTypingUsers((current) => current.filter((id) => id !== typingUserId))
    const onSocketError = (payload) => {
      if (['send_message', 'send_private_message'].includes(payload.event)) setError(payload.message)
    }

    socket.on('new_message', onMessage)
    socket.on('new_private_message', onPrivateMessage)
    socket.on('message_status', onStatus)
    socket.on('user_typing', onTyping)
    socket.on('user_stop_typing', onStopTyping)
    socket.on('socket_error', onSocketError)

    return () => {
      active = false
      socket.emit('leave_conversation', { conversationId: conversation._id })
      socket.off('new_message', onMessage)
      socket.off('new_private_message', onPrivateMessage)
      socket.off('message_status', onStatus)
      socket.off('user_typing', onTyping)
      socket.off('user_stop_typing', onStopTyping)
      socket.off('socket_error', onSocketError)
    }
  // hydrateMessage intentionally follows the selected conversation snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, conversation?._id, socket, identity, currentUserId, indexSearch])

  const ensureReady = () => {
    if (!identity) throw new Error('Thiết bị chưa có khóa mã hóa.')
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
      const moderation = await api.post('/ai/moderate', { text: plaintext })
      if (moderation.moderation?.is_moderated === false) setError('AI moderation tạm thời không khả dụng; tin nhắn vẫn được gửi theo fallback policy.')
      const encrypted = await encryptText(plaintext, recipients, identity)
      const tempId = crypto.randomUUID()
      pendingPlaintext.current.set(tempId, plaintext)
      const payload = { conversationId: conversation._id, ...encrypted, msgType: 'TEXT', tempId }
      if (isPrivacy) {
        setMessages((current) => [...current, { _id: tempId, tempId, conversationId: conversation._id, senderId: currentUser, text: plaintext, decrypted: true, verified: true, msgType: 'TEXT', status: 'SENT', createdAt: new Date().toISOString() }])
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

  const uploadFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setSending(true)
    setError('')
    try {
      ensureReady()
      const encrypted = await encryptFile(file, recipients, identity)
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
      setMessages((current) => uniqueMessages([...current, hydrated]))
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
    try {
      const payload = await api.post('/messages/search', { keyword: searchKeyword, conversationId: conversation._id, limit: 30 })
      setSearchResults(payload.results)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const summarize = async () => {
    setError('')
    const source = messages.filter((message) => /^[a-f0-9]{24}$/i.test(String(message._id)) && message.decrypted && message.msgType !== 'FILE').slice(-100)
    if (!source.length) return setError('Không có tin nhắn đã giải mã và lưu DB để tóm tắt.')
    try {
      const payload = await api.post('/ai/summarize', {
        conversationId: conversation._id,
        messageIds: source.map((message) => String(message._id)),
        messages: source.map((message) => ({ messageId: String(message._id), text: message.text })),
      })
      setSummary(payload)
      setPanel('summary')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (!conversation) {
    return <div className="grid h-full place-items-center p-8 text-center"><div><p className="eyebrow">Encrypted workspace</p><h2 className="mt-4 font-display text-4xl">Chọn một hội thoại</h2><p className="mt-3 text-sm text-slate-500">Tin nhắn sẽ được giải mã cục bộ sau khi bạn chọn.</p></div></div>
  }

  const otherTyping = typingUsers.map((id) => displayName(memberById.get(id))).join(', ')

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-7">
          <div className="min-w-0"><h2 className="truncate text-lg font-bold">{conversationTitle(conversation, currentUserId)}</h2><p className="mt-1 text-[11px] text-slate-500">{members.length} thành viên · <span className={isPrivacy ? 'text-amber' : 'text-mint'}>{isPrivacy ? 'Privacy / ephemeral' : 'KYC / persisted ciphertext'}</span></p></div>
          <div className="flex shrink-0 gap-2">
            <button className="btn-secondary hidden sm:block" onClick={() => setPanel(panel === 'search' ? null : 'search')}>Tìm kiếm</button>
            <button className="btn-secondary" disabled={isPrivacy} onClick={summarize}>AI tóm tắt</button>
          </div>
        </header>

        {error && <div className="mx-5 mt-3 flex items-start justify-between gap-3 rounded-xl border border-amber/25 bg-amber/10 px-4 py-3 text-xs text-amber sm:mx-7"><span>{error}</span><button onClick={() => setError('')}>×</button></div>}

        <div className="scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-6 sm:px-7">
          {loading && <p className="text-center text-xs text-slate-600">Đang tải ciphertext và giải mã...</p>}
          {!loading && messages.length === 0 && <div className="py-16 text-center"><p className="font-display text-2xl text-slate-300">Bắt đầu bằng một tin nhắn.</p><p className="mt-2 text-xs text-slate-600">Nội dung được mã hóa trước khi rời trình duyệt.</p></div>}
          {messages.map((message) => {
            const mine = userId(message.senderId) === currentUserId
            return (
              <article className={`flex ${mine ? 'justify-end' : 'justify-start'}`} key={String(message._id || message.tempId)}>
                <div className={`max-w-[82%] rounded-2xl border px-4 py-3 sm:max-w-[68%] ${mine ? 'border-mint/20 bg-mint/10' : 'border-line bg-white/[.035]'}`}>
                  {!mine && <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber">{displayName(message.senderId)}</p>}
                  {message.msgType === 'FILE' ? (
                    <button className="flex w-full items-center gap-3 text-left" onClick={() => openFile(message)}>
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-[10px] font-bold text-mint">FILE</span>
                      <span className="min-w-0"><strong className="block truncate text-sm">{message.fileName || 'Tệp mã hóa'}</strong><small className="text-slate-500">{fileSize(message.fileSizeBytes)} · giải mã khi tải</small></span>
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
          <div className="flex items-end gap-2 rounded-2xl border border-line bg-ink/70 p-2 focus-within:border-mint/60">
            <input ref={fileInput} className="hidden" type="file" onChange={uploadFile} />
            <button className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl text-slate-500 hover:bg-white/5 hover:text-paper" disabled={isPrivacy || sending} onClick={() => fileInput.current?.click()} type="button" title={isPrivacy ? 'Privacy mode không lưu file trên server' : 'Gửi file mã hóa'}>+</button>
            <textarea className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-600" maxLength={4000} placeholder={identity ? 'Nhập tin nhắn...' : 'Tạo khóa thiết bị để nhắn tin'} rows={1} value={draft} onChange={(event) => updateDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit() } }} />
            <button className="btn-primary h-10 shrink-0" disabled={!draft.trim() || sending || !identity} type="submit">{sending ? '...' : 'Gửi'}</button>
          </div>
          {!isPrivacy && <label className="mt-2 flex items-center gap-2 text-[10px] text-slate-600"><input checked={indexSearch} type="checkbox" onChange={(event) => { setIndexSearch(event.target.checked); localStorage.setItem('secure-chat-index-search', String(event.target.checked)) }} /> Cho phép gửi snippet plaintext lên chỉ mục tìm kiếm TTL 24 giờ</label>}
        </form>
      </section>

      {panel && (
        <aside className="scrollbar absolute inset-y-0 right-0 z-20 w-[min(90vw,360px)] overflow-y-auto border-l border-line bg-panel p-5 shadow-2xl lg:static lg:w-80 lg:shadow-none">
          <div className="flex items-center justify-between"><p className="eyebrow">{panel === 'search' ? 'Message search' : 'AI summary'}</p><button className="text-xl text-slate-500" onClick={() => setPanel(null)}>×</button></div>
          {panel === 'search' ? (
            <>
              <form className="mt-5 flex gap-2" onSubmit={runSearch}><input className="field" maxLength={200} placeholder="Từ khóa" value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} /><button className="btn-primary" type="submit">Tìm</button></form>
              <p className="mt-3 text-[10px] leading-5 text-slate-600">Chỉ tìm các snippet mà người gửi đã chủ động lập chỉ mục.</p>
              <div className="mt-5 space-y-3">{searchResults.map((result) => <article className="rounded-xl border border-line bg-ink/50 p-3" key={result._id}><p className="message-mark text-xs leading-5 text-slate-300"><HighlightedSnippet value={result.highlightedSnippet} /></p><small className="mt-2 block text-slate-600">{shortTime(result.createdAt)}</small></article>)}</div>
            </>
          ) : (
            <div className="mt-5"><div className="rounded-xl border border-mint/20 bg-mint/5 p-4"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{summary?.summary || 'Đang tạo tóm tắt...'}</p></div>{summary && <p className="mt-3 text-[10px] text-slate-600">{summary.messageCount} tin nhắn · {summary.cached ? 'cache' : summary.model}</p>}<p className="mt-5 text-[10px] leading-5 text-amber">Plaintext của các tin đã chọn được gửi tới Gemini khi bạn bấm tóm tắt; nguồn plaintext không được lưu trong Message.</p></div>
          )}
        </aside>
      )}
    </div>
  )
}
