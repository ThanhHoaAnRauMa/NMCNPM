import { useState } from 'react'
import { BrowserProvider, Contract } from 'ethers'
import { decryptText } from '../lib/crypto.js'
import { createEvidencePackage, verifyEvidencePackage } from '../lib/evidence.js'

const ABI = [
  'function createRoom(bytes32 roomId, address[] participants, uint256 disputeWindow)',
  'function proposeRoot(bytes32 roomId, bytes32 newRoot)',
  'function disputeRoot(bytes32 roomId)',
  'function confirmRoot(bytes32 roomId)',
  'function verifyProof(bytes32 roomId, bytes32 leaf, bytes32[] proof) view returns (bool)',
]

export default function ForensicsPanel({ api, conversations, currentUser, identity }) {
  const [account, setAccount] = useState('')
  const [conversationId, setConversationId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [participantAddresses, setParticipantAddresses] = useState('')
  const [disputeWindow, setDisputeWindow] = useState('86400')
  const [evidence, setEvidence] = useState(null)
  const [verification, setVerification] = useState(null)
  const [selectedMessage, setSelectedMessage] = useState(0)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS || ''
  const currentUserId = currentUser?.id || currentUser?._id

  const provider = () => {
    if (!window.ethereum) throw new Error('An EVM browser wallet is required.')
    return new BrowserProvider(window.ethereum)
  }

  const connect = async () => {
    setError('')
    try { setAccount(await (await provider().getSigner()).getAddress()) } catch (walletError) { setError(walletError.message) }
  }

  const loadAllMessages = async (selected) => {
    const messages = []
    let before = null
    do {
      const query = before ? `?limit=100&before=${before}` : '?limit=100'
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
      const selected = conversations.find((item) => String(item._id) === conversationId)
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
      const created = createEvidencePackage({ conversation: selected, messages: hydrated, roomId: roomId.trim() })
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

  const writeContract = async (method, ...args) => {
    setError('')
    setBusy(true)
    try {
      if (!contractAddress) throw new Error('VITE_CONTRACT_ADDRESS is not configured.')
      const signer = await provider().getSigner()
      setAccount(await signer.getAddress())
      const transaction = await new Contract(contractAddress, ABI, signer)[method](...args)
      setNotice(`Transaction submitted: ${transaction.hash}`)
      await transaction.wait()
      setNotice(`Transaction confirmed: ${transaction.hash}`)
    } catch (contractError) { setError(contractError.shortMessage || contractError.message) } finally { setBusy(false) }
  }

  const createRoom = async () => {
    try {
      const signerAddress = await (await provider().getSigner()).getAddress()
      const participants = participantAddresses.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean)
      await writeContract('createRoom', roomId.trim(), participants.length ? participants : [signerAddress], BigInt(disputeWindow))
    } catch (roomError) { setError(roomError.shortMessage || roomError.message) }
  }

  const verifyOnChain = async () => {
    setError('')
    try {
      if (!contractAddress) throw new Error('VITE_CONTRACT_ADDRESS is not configured.')
      const message = evidence?.messages[selectedMessage]
      if (!message) throw new Error('Select an evidence message.')
      const valid = await new Contract(contractAddress, ABI, provider()).verifyProof(evidence.roomId, message.leaf, message.proof)
      setNotice(valid ? 'Proof matches the confirmed on-chain root.' : 'Proof does not match the confirmed on-chain root.')
    } catch (verifyError) { setError(verifyError.shortMessage || verifyError.message) }
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
            <label className="mt-4 block text-xs font-semibold text-slate-300">KYC conversation<select className="field mt-2" value={conversationId} onChange={(event) => setConversationId(event.target.value)}><option value="">Select conversation</option>{conversations.filter((item) => item.mode !== 'PRIVACY').map((item) => <option key={item._id} value={item._id}>{item.groupName || item._id}</option>)}</select></label>
            <label className="mt-4 block text-xs font-semibold text-slate-300">Contract room ID (bytes32)<input className="field mt-2 font-mono" placeholder="0x..." value={roomId} onChange={(event) => setRoomId(event.target.value)} /></label>
            <button className="btn-primary mt-5 w-full" disabled={busy} onClick={buildEvidence}>Build local evidence package</button>
            <label className="btn-secondary mt-3 block cursor-pointer text-center">Import and verify package<input className="hidden" accept="application/json,.json" type="file" onChange={importEvidence} /></label>
          </section>

          <section className="panel rounded-2xl p-6">
            <div className="flex items-center justify-between"><p className="eyebrow">Package status</p><span className={`rounded-full px-3 py-1 text-[10px] font-bold ${verification?.valid ? 'bg-mint/10 text-mint' : 'bg-amber/10 text-amber'}`}>{verification ? (verification.valid ? 'VALID' : 'INVALID') : 'NOT LOADED'}</span></div>
            <dl className="mt-5 space-y-3 break-all font-mono text-xs text-slate-400"><div><dt className="text-slate-600">Root</dt><dd>{evidence?.merkleRoot || '-'}</dd></div><div><dt className="text-slate-600">Messages</dt><dd>{evidence?.messages.length || 0}</dd></div></dl>
            <button className="btn-secondary mt-5 w-full" disabled={!evidence} onClick={downloadEvidence}>Download evidence JSON</button>
          </section>

          <section className="panel rounded-2xl p-6 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Sepolia contract</p><p className="mt-2 break-all font-mono text-xs text-slate-500">{account || 'Wallet not connected'}</p></div><button className="btn-secondary" onClick={connect}>Connect wallet</button></div>
            <p className="mt-4 text-xs leading-5 text-amber">Create the room once with the participant wallets, then use the same room ID for root actions. Every state-changing call requires explicit wallet confirmation.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px]"><label className="text-xs font-semibold text-slate-300">Participant wallets<input className="field mt-2 font-mono" placeholder="0x..., 0x..." value={participantAddresses} onChange={(event) => setParticipantAddresses(event.target.value)} /></label><label className="text-xs font-semibold text-slate-300">Dispute window (seconds)<input className="field mt-2" min="60" type="number" value={disputeWindow} onChange={(event) => setDisputeWindow(event.target.value)} /></label></div>
            <button className="btn-secondary mt-3 w-full" disabled={busy || !roomId || Number(disputeWindow) < 60} onClick={createRoom}>Create contract room</button>
            <div className="mt-5 grid gap-2 sm:grid-cols-3"><button className="btn-primary" disabled={!evidence || busy} onClick={() => writeContract('proposeRoot', evidence.roomId, evidence.merkleRoot)}>Propose root</button><button className="btn-secondary" disabled={!evidence || busy} onClick={() => writeContract('disputeRoot', evidence.roomId)}>Dispute pending root</button><button className="btn-secondary" disabled={!evidence || busy} onClick={() => writeContract('confirmRoot', evidence.roomId)}>Confirm pending root</button></div>
            <div className="mt-5 flex gap-2"><select className="field" disabled={!evidence} value={selectedMessage} onChange={(event) => setSelectedMessage(Number(event.target.value))}>{evidence?.messages.map((message, index) => <option key={message.messageId} value={index}>#{index + 1} {message.messageId}</option>)}</select><button className="btn-secondary shrink-0" disabled={!evidence} onClick={verifyOnChain}>Verify proof</button></div>
          </section>
        </div>
      </div>
    </div>
  )
}
