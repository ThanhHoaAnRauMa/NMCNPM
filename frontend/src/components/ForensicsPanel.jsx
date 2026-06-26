import { useEffect, useMemo, useState } from 'react'
import { decryptText } from '../lib/crypto.js'
import { DECRYPT_MESSAGES } from '../lib/encryptionMode.js'
import { createEvidencePackage, roomIdForConversation, verifyEvidencePackage } from '../lib/evidence.js'

export default function ForensicsPanel({ api, conversations, currentUser, identity, notify }) {
  const [conversationId, setConversationId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [evidence, setEvidence] = useState(null)
  const [verification, setVerification] = useState(null)
  const [selectedMessage, setSelectedMessage] = useState(0)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const currentUserId = currentUser?.id || currentUser?._id
  const selectedConversation = useMemo(() => conversations.find((item) => String(item._id) === conversationId) || null, [conversationId, conversations])

  useEffect(() => {
    setRoomId(selectedConversation ? roomIdForConversation(selectedConversation) : '')
  }, [selectedConversation])

  const loadAllMessages = async (selected) => {
    const messages = []
    let before = null
    do {
      const query = before ? `?limit=100&includeHidden=true&before=${before}` : '?limit=100&includeHidden=true'
      const page = await api.get(`/chat/${selected._id}/messages${query}`)
      messages.unshift(...page.messages)
      before = page.nextCursor
      if (messages.length >= 2000 && before) throw new Error('Gói evidence chỉ hỗ trợ tối đa 2.000 tin nhắn.')
    } while (before)
    return messages
  }

  const buildEvidence = async () => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const selected = selectedConversation
      if (!selected) throw new Error('Chọn một cuộc trò chuyện trước.')
      if (selected.mode === 'PRIVACY') throw new Error('Privacy conversation không lưu evidence log persisted.')
      if (DECRYPT_MESSAGES && !identity) throw new Error('Thiết bị này chưa có khóa giải mã.')
      const messages = await loadAllMessages(selected)
      const hydrated = await Promise.all(messages.map(async (message) => {
        let plaintext = null
        if (DECRYPT_MESSAGES && message.msgType !== 'FILE') {
          try { plaintext = await decryptText(message.encryptedContent, currentUserId, identity) } catch (_error) { plaintext = null }
        }
        return { ...message, plaintext }
      }))
      const created = createEvidencePackage({ conversation: selected, messages: hydrated, roomId: roomIdForConversation(selected) })
      setEvidence(created)
      setVerification(await verifyEvidencePackage(created))
      setSelectedMessage(0)
      const message = `Đã tạo evidence package với ${created.messages.length} tin nhắn.`
      setNotice(message)
      notify?.(message, { type: 'success', title: 'Evidence' })
    } catch (buildError) {
      setError(buildError.message)
      notify?.(buildError.message, { type: 'error', title: 'Evidence' })
    } finally { setBusy(false) }
  }

  const downloadEvidence = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `evidence-${evidence.conversation.id}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    notify?.('Đã tải evidence JSON.', { type: 'success' })
  }

  const importEvidence = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    try {
      const imported = JSON.parse(await file.text())
      const checked = await verifyEvidencePackage(imported)
      setEvidence(imported)
      setRoomId(imported.roomId)
      setVerification(checked)
      setSelectedMessage(0)
      const message = checked.valid ? 'Evidence package hợp lệ.' : 'Evidence package không vượt qua kiểm tra local.'
      setNotice(message)
      notify?.(message, { type: checked.valid ? 'success' : 'warning', title: 'Evidence' })
    } catch (importError) {
      setError(importError.message)
      notify?.(importError.message, { type: 'error', title: 'Import evidence' })
    }
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId)
      setNotice('Đã copy Room ID.')
      notify?.('Đã copy Room ID.', { type: 'success' })
    } catch (_error) {
      const message = 'Không thể copy Room ID. Hãy chọn và copy thủ công.'
      setError(message)
      notify?.(message, { type: 'error' })
    }
  }

  return (
    <div className="scrollbar h-full overflow-y-auto p-5 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <p className="eyebrow">Forensic evidence</p>
        <h2 className="mt-3 font-display text-4xl">Evidence package và Merkle root</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Package được tạo và kiểm tra ngay trong trình duyệt. Transcript đã giải mã và private key không được upload bởi luồng này.</p>
        {(error || notice) && <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-400/30 bg-red-400/10 text-red-200' : 'border-mint/30 bg-mint/10 text-mint'}`}>{error || notice}</div>}

        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          <section className="panel rounded-2xl p-6">
            <p className="eyebrow">Create or import</p>
            <label className="mt-4 block text-xs font-semibold text-slate-300">KYC conversation<select className="field mt-2" value={conversationId} onChange={(event) => setConversationId(event.target.value)}><option value="">Chọn cuộc trò chuyện</option>{conversations.filter((item) => item.mode !== 'PRIVACY').map((item) => <option key={item._id} value={item._id}>{item.groupName || item.roomId || item._id}</option>)}</select></label>
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-semibold text-slate-300" htmlFor="conversation-room-id">Conversation Room ID</label>
                <button className="text-[11px] font-semibold text-mint hover:text-paper disabled:text-slate-600" disabled={!roomId} onClick={copyRoomId} type="button">Copy</button>
              </div>
              <input className="field mt-2 font-mono" id="conversation-room-id" placeholder="Chọn một cuộc trò chuyện" readOnly value={roomId} />
              <p className="mt-2 text-[11px] leading-5 text-slate-500">Room ID được suy ra từ conversation và được đưa vào evidence package khi export.</p>
            </div>
            <button className="btn-primary mt-5 w-full" disabled={busy} onClick={buildEvidence} type="button">{busy ? 'Đang tạo package...' : 'Build local evidence package'}</button>
            <label className="btn-secondary mt-3 block cursor-pointer text-center">Import and verify package<input className="hidden" accept="application/json,.json" type="file" onChange={importEvidence} /></label>
          </section>

          <section className="panel rounded-2xl p-6">
            <div className="flex items-center justify-between"><p className="eyebrow">Package status</p><span className={`rounded-full px-3 py-1 text-[10px] font-bold ${verification?.valid ? 'bg-mint/10 text-mint' : 'bg-amber/10 text-amber'}`}>{verification ? (verification.valid ? 'VALID' : 'INVALID') : 'NOT LOADED'}</span></div>
            <dl className="mt-5 space-y-3 break-all font-mono text-xs text-slate-400"><div><dt className="text-slate-600">Root</dt><dd>{evidence?.merkleRoot || '-'}</dd></div><div><dt className="text-slate-600">Messages</dt><dd>{evidence?.messages.length || 0}</dd></div></dl>
            <button className="btn-secondary mt-5 w-full" disabled={!evidence} onClick={downloadEvidence} type="button">Download evidence JSON</button>
          </section>

          <section className="panel rounded-2xl p-6 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Local proof check</p>
                <p className="mt-2 text-sm text-slate-400">Kiểm tra proof của tin nhắn đã chọn với Merkle root trong package đang import hoặc vừa tạo.</p>
              </div>
            </div>
            <div className="mt-5 flex gap-2"><select className="field" disabled={!evidence} value={selectedMessage} onChange={(event) => setSelectedMessage(Number(event.target.value))}>{evidence?.messages.map((message, index) => <option key={message.messageId} value={index}>#{index + 1} {message.messageId}</option>)}</select><span className="btn-secondary shrink-0 cursor-default">{verification?.checks?.[selectedMessage]?.proof ? 'Proof OK' : 'No proof'}</span></div>
          </section>
        </div>
      </div>
    </div>
  )
}
