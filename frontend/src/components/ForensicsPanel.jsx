import { useEffect, useMemo, useState } from 'react'
import { decryptText } from '../lib/crypto.js'
import { createEvidencePackage, roomIdForConversation, verifyEvidencePackage } from '../lib/evidence.js'

export default function ForensicsPanel({ api, conversations, currentUser, identity }) {
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
      if (messages.length >= 2000 && before) throw new Error('Evidence export is limited to 2,000 messages per package.')
    } while (before)
    return messages
  }

  const buildEvidence = async () => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const selected = selectedConversation
      if (!selected) throw new Error('Select a conversation.')
      if (selected.mode === 'PRIVACY') throw new Error('Privacy conversations are ephemeral and have no persisted evidence log.')
      if (!identity) throw new Error('This device has no decryption identity.')
      const messages = await loadAllMessages(selected)
      const hydrated = await Promise.all(messages.map(async (message) => {
        let plaintext = null
        if (message.msgType !== 'FILE') {
          try { plaintext = await decryptText(message.encryptedContent, currentUserId, identity) } catch (_error) { plaintext = null }
        }
        return { ...message, plaintext }
      }))
      const created = createEvidencePackage({ conversation: selected, messages: hydrated, roomId: roomIdForConversation(selected) })
      setEvidence(created)
      setVerification(await verifyEvidencePackage(created))
      setSelectedMessage(0)
      setNotice(`Evidence package created with ${created.messages.length} messages.`)
    } catch (buildError) {
      setError(buildError.message)
    } finally { setBusy(false) }
  }

  const downloadEvidence = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `evidence-${evidence.conversation.id}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
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
      setNotice(checked.valid ? 'Evidence package is internally valid.' : 'Evidence package failed local verification.')
    } catch (importError) { setError(importError.message) }
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId)
      setNotice('Room ID copied.')
    } catch (_error) {
      setError('Could not copy Room ID. Select and copy it manually.')
    }
  }

  return (
    <div className="scrollbar h-full overflow-y-auto p-5 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <p className="eyebrow">Forensic evidence</p>
        <h2 className="mt-3 font-display text-4xl">Evidence package and Merkle root</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Packages are created and checked in this browser. Decrypted transcript text and private keys are never uploaded by this flow.</p>
        {(error || notice) && <div className={`mt-5 rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-400/30 bg-red-400/10 text-red-200' : 'border-mint/30 bg-mint/10 text-mint'}`}>{error || notice}</div>}

        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          <section className="panel rounded-2xl p-6">
            <p className="eyebrow">Create or import</p>
            <label className="mt-4 block text-xs font-semibold text-slate-300">KYC conversation<select className="field mt-2" value={conversationId} onChange={(event) => setConversationId(event.target.value)}><option value="">Select conversation</option>{conversations.filter((item) => item.mode !== 'PRIVACY').map((item) => <option key={item._id} value={item._id}>{item.groupName || item.roomId || item._id}</option>)}</select></label>
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-xs font-semibold text-slate-300" htmlFor="conversation-room-id">Conversation Room ID</label>
                <button className="text-[11px] font-semibold text-mint hover:text-paper disabled:text-slate-600" disabled={!roomId} onClick={copyRoomId} type="button">Copy</button>
              </div>
              <input className="field mt-2 font-mono" id="conversation-room-id" placeholder="Select a conversation" readOnly value={roomId} />
              <p className="mt-2 text-[11px] leading-5 text-slate-500">Room ID is derived from the conversation and is included in exported evidence packages.</p>
            </div>
            <button className="btn-primary mt-5 w-full" disabled={busy} onClick={buildEvidence}>Build local evidence package</button>
            <label className="btn-secondary mt-3 block cursor-pointer text-center">Import and verify package<input className="hidden" accept="application/json,.json" type="file" onChange={importEvidence} /></label>
          </section>

          <section className="panel rounded-2xl p-6">
            <div className="flex items-center justify-between"><p className="eyebrow">Package status</p><span className={`rounded-full px-3 py-1 text-[10px] font-bold ${verification?.valid ? 'bg-mint/10 text-mint' : 'bg-amber/10 text-amber'}`}>{verification ? (verification.valid ? 'VALID' : 'INVALID') : 'NOT LOADED'}</span></div>
            <dl className="mt-5 space-y-3 break-all font-mono text-xs text-slate-400"><div><dt className="text-slate-600">Root</dt><dd>{evidence?.merkleRoot || '-'}</dd></div><div><dt className="text-slate-600">Messages</dt><dd>{evidence?.messages.length || 0}</dd></div></dl>
            <button className="btn-secondary mt-5 w-full" disabled={!evidence} onClick={downloadEvidence}>Download evidence JSON</button>
          </section>

          <section className="panel rounded-2xl p-6 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Local proof check</p>
                <p className="mt-2 text-sm text-slate-400">Verify the selected message proof against the Merkle root inside the imported or generated evidence package.</p>
              </div>
            </div>
            <div className="mt-5 flex gap-2"><select className="field" disabled={!evidence} value={selectedMessage} onChange={(event) => setSelectedMessage(Number(event.target.value))}>{evidence?.messages.map((message, index) => <option key={message.messageId} value={index}>#{index + 1} {message.messageId}</option>)}</select><span className="btn-secondary shrink-0 cursor-default">{verification?.checks?.[selectedMessage]?.proof ? 'Proof OK' : 'No proof'}</span></div>
          </section>
        </div>
      </div>
    </div>
  )
}
