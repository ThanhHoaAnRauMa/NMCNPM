import { useState } from 'react'
import KycBadge from './KycBadge.jsx'
import Modal from './Modal.jsx'
import { displayName, userId } from '../lib/format.js'

export default function NewConversationModal({ api, notify, onClose, onCreated }) {
  const [kind, setKind] = useState('direct')
  const [mode, setMode] = useState('KYC')
  const [groupName, setGroupName] = useState('')
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const search = async (event) => {
    event.preventDefault()
    setError('')
    try {
      const payload = await api.get(`/users/search?q=${encodeURIComponent(query)}`)
      setUsers(payload.users)
    } catch (requestError) {
      setError(requestError.message)
      notify?.(requestError.message, { type: 'error', title: 'Tìm người dùng' })
    }
  }

  const toggle = (user) => {
    const id = userId(user)
    setSelected((current) => current.some((item) => userId(item) === id) ? current.filter((item) => userId(item) !== id) : kind === 'direct' ? [user] : [...current, user])
  }

  const create = async () => {
    if (!selected.length) {
      const message = 'Chọn ít nhất một người dùng.'
      setError(message)
      notify?.(message, { type: 'warning' })
      return
    }
    if (kind === 'group' && !groupName.trim()) {
      const message = 'Nhập tên nhóm.'
      setError(message)
      notify?.(message, { type: 'warning' })
      return
    }
    setBusy(true)
    setError('')
    try {
      let conversationId
      if (kind === 'direct') {
        const payload = await api.post(`/users/${userId(selected[0])}/conversation`, { mode })
        conversationId = payload.conversationId
      } else {
        const payload = await api.post('/groups', { name: groupName.trim(), mode, memberIds: selected.map(userId) })
        conversationId = payload.group._id
      }
      await onCreated(conversationId)
      notify?.('Đã mở cuộc trò chuyện.', { type: 'success' })
      onClose()
    } catch (requestError) {
      setError(requestError.message)
      notify?.(requestError.message, { type: 'error', title: 'Tạo cuộc trò chuyện' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Cuộc trò chuyện mới" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-ink/70 p-1">
        {[['direct', 'Trực tiếp'], ['group', 'Nhóm']].map(([id, label]) => (
          <button className={`rounded-lg py-2 text-sm font-semibold ${kind === id ? 'bg-white/10 text-paper' : 'text-slate-500'}`} key={id} onClick={() => { setKind(id); setSelected([]) }} type="button">{label}</button>
        ))}
      </div>
      {kind === 'group' && <input className="field mt-4" maxLength={128} placeholder="Tên nhóm" value={groupName} onChange={(event) => setGroupName(event.target.value)} />}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[['KYC', 'KYC mode'], ['PRIVACY', 'Privacy mode']].map(([id, label]) => (
          <button className={`rounded-xl border px-3 py-3 text-xs font-bold ${mode === id ? 'border-mint bg-mint/10 text-mint' : 'border-line text-slate-500'}`} key={id} onClick={() => setMode(id)} type="button">{label}</button>
        ))}
      </div>
      <form className="mt-5 flex gap-2" onSubmit={search}>
        <input className="field" minLength={2} placeholder="Tìm username hoặc email" value={query} onChange={(event) => setQuery(event.target.value)} />
        <button className="btn-secondary" type="submit">Tìm</button>
      </form>
      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
        {users.map((user) => {
          const active = selected.some((item) => userId(item) === userId(user))
          return (
            <button className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${active ? 'border-mint bg-mint/10' : 'border-line bg-white/[.025]'}`} key={userId(user)} onClick={() => toggle(user)} type="button">
              <span className="min-w-0">
                <strong className="flex items-center gap-1.5 text-sm">
                  <span className="truncate">{displayName(user)}</span>
                  <KycBadge user={user} />
                </strong>
                <small className="text-slate-500">@{user.username} · {user.kycStatus}</small>
              </span>
              <span className={active ? 'text-mint' : 'text-slate-600'}>{active ? 'Đã chọn' : 'Chọn'}</span>
            </button>
          )
        })}
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
      <button className="btn-primary mt-6 w-full" disabled={busy} onClick={create} type="button">{busy ? 'Đang tạo...' : kind === 'direct' ? 'Bắt đầu trò chuyện' : 'Tạo nhóm'}</button>
    </Modal>
  )
}
