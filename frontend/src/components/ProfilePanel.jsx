import { useEffect, useRef, useState } from 'react'
import { createKycProof } from '../lib/crypto.js'
import { createIdentityBackup, restoreIdentityBackup } from '../lib/keyBackup.js'

export default function ProfilePanel({ api, identity, keyStatus, onCreateIdentity, onProfileChanged, onRestoreIdentity, onSynchronizeIdentity, userId }) {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ displayName: '', avatarUrl: '' })
  const [statement, setStatement] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [backupPassword, setBackupPassword] = useState('')
  const backupInput = useRef(null)
  const keyReady = Boolean(identity) && keyStatus === 'ready'

  useEffect(() => {
    api.get('/users/me').then(({ user }) => {
      setProfile(user)
      setForm({ displayName: user.displayName || '', avatarUrl: user.avatarUrl || '' })
    }).catch((requestError) => setError(requestError.message))
  }, [api])

  const save = async (event) => {
    event.preventDefault()
    setError('')
    try {
      const payload = await api.put('/users/profile', form)
      setProfile(payload.user)
      onProfileChanged(payload.user)
      setNotice('Đã cập nhật hồ sơ.')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const submitKyc = async () => {
    setError('')
    if (!keyReady) return setError('Khóa thiết bị phải khớp tài khoản trước khi gửi KYC.')
    if (statement.trim().length < 10) return setError('Nội dung xác minh phải có ít nhất 10 ký tự.')
    try {
      const proof = await createKycProof(statement.trim(), identity)
      const payload = await api.post('/kyc/submit', { ...proof, pubkey: identity.publicBundle })
      setProfile((current) => ({ ...current, kycStatus: payload.kycRecord.status }))
      setNotice('Bằng chứng KYC đã gửi và đang chờ duyệt.')
      setStatement('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const exportBackup = async () => {
    setError('')
    try {
      if (!identity) throw new Error('No device identity is available to back up.')
      const contents = await createIdentityBackup(userId, identity, backupPassword)
      const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `secure-chat-key-${userId}.json`
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Encrypted key backup created. Store the file and password separately.')
    } catch (backupError) {
      setError(backupError.message)
    }
  }

  const importBackup = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    try {
      const restored = await restoreIdentityBackup(await file.text(), backupPassword, userId)
      await onRestoreIdentity(restored)
      setNotice('Device identity restored and public key synchronized.')
    } catch (backupError) {
      setError(backupError.message)
    }
  }

  const synchronizeLocalKey = async () => {
    if (!window.confirm('Dùng khóa của thiết bị này làm khóa tài khoản? Thiết bị đang giữ khóa khác sẽ phải restore backup này.')) return
    setError('')
    try {
      await onSynchronizeIdentity()
      setNotice('Đã đồng bộ public key của thiết bị này với tài khoản.')
    } catch (syncError) {
      setError(syncError.message)
    }
  }

  const replaceRemoteKey = async () => {
    if (!window.confirm('Tạo khóa mới sẽ làm lịch sử dùng khóa cũ không thể giải mã nếu không có backup. Tiếp tục?')) return
    await onCreateIdentity({ replace: true })
  }

  return (
    <div className="scrollbar h-full overflow-y-auto p-5 sm:p-8">
      <div className="mx-auto max-w-4xl">
        <p className="eyebrow">Identity center</p>
        <h2 className="mt-3 font-display text-4xl">Hồ sơ và danh tính số</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Quản lý thông tin hiển thị, khóa thiết bị và trạng thái xác minh. Máy chủ chỉ giữ public key.</p>

        {(error || notice) && <div className={`mt-6 rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-400/30 bg-red-400/10 text-red-200' : 'border-mint/30 bg-mint/10 text-mint'}`}>{error || notice}</div>}

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <form className="panel rounded-2xl p-6" onSubmit={save}>
            <p className="eyebrow">Public profile</p>
            <h3 className="mt-2 text-xl font-bold">Thông tin hiển thị</h3>
            <label className="mt-6 block text-xs font-semibold text-slate-300">Tên hiển thị<input className="field mt-2" maxLength={80} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
            <label className="mt-4 block text-xs font-semibold text-slate-300">Avatar URL<input className="field mt-2" type="url" value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} /></label>
            <div className="mt-5 rounded-xl bg-ink/60 p-4 text-xs leading-6 text-slate-400">
              <div className="flex justify-between"><span>Username</span><strong className="text-paper">@{profile?.username || '...'}</strong></div>
              <div className="flex justify-between"><span>Email</span><strong className="text-paper">{profile?.email || '...'}</strong></div>
            </div>
            <button className="btn-primary mt-5 w-full" type="submit">Lưu thay đổi</button>
          </form>

          <section className="panel rounded-2xl p-6">
            <p className="eyebrow">Device key</p>
            <h3 className="mt-2 text-xl font-bold">Khóa mã hóa cục bộ</h3>
            <div className={`mt-6 rounded-xl border p-4 ${keyReady ? 'border-mint/30 bg-mint/10' : 'border-amber/30 bg-amber/10'}`}>
              <strong className={keyReady ? 'text-mint' : 'text-amber'}>{keyReady ? 'Thiết bị đã sẵn sàng' : keyStatus === 'mismatch' ? 'Khóa thiết bị không khớp tài khoản' : keyStatus === 'remote-only' ? 'Khóa tài khoản chỉ có trên thiết bị khác' : 'Khóa thiết bị chưa sẵn sàng'}</strong>
              <p className="mt-2 text-xs leading-5 text-slate-400">{keyReady ? 'RSA-OAEP dùng bọc khóa tin nhắn, ECDSA P-256 dùng ký payload.' : 'Restore backup để giữ cùng danh tính số. Chỉ thay thế hoặc đồng bộ khóa khi bạn chấp nhận các thiết bị dùng khóa khác sẽ bị lệch.'}</p>
            </div>
            {!identity && keyStatus === 'missing' && <button className="btn-secondary mt-5 w-full" onClick={() => onCreateIdentity()}>Tạo khóa cho thiết bị này</button>}
            {!identity && keyStatus === 'remote-only' && <button className="btn-secondary mt-5 w-full" onClick={replaceRemoteKey}>Thay thế bằng khóa mới</button>}
            {identity && ['mismatch', 'local-only'].includes(keyStatus) && <button className="btn-secondary mt-5 w-full" onClick={synchronizeLocalKey}>Dùng khóa thiết bị này cho tài khoản</button>}
            <div className="mt-5 border-t border-line pt-5 text-xs leading-5 text-slate-500">Private key được lưu trong IndexedDB của trình duyệt và không xuất hiện trong request API.</div>
          </section>

          <section className="panel rounded-2xl p-6 lg:col-span-2">
            <p className="eyebrow">Encrypted recovery</p>
            <h3 className="mt-2 text-xl font-bold">Device-key backup</h3>
            <p className="mt-3 text-xs leading-5 text-slate-400">The private identity is encrypted locally with PBKDF2 and AES-GCM. The backup and password are never sent to the API.</p>
            <label className="mt-5 block text-xs font-semibold text-slate-300">Backup password<input className="field mt-2" minLength={12} placeholder="At least 12 characters" type="password" value={backupPassword} onChange={(event) => setBackupPassword(event.target.value)} /></label>
            <input ref={backupInput} className="hidden" accept="application/json,.json" type="file" onChange={importBackup} />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button className="btn-secondary" disabled={!identity || backupPassword.length < 12} onClick={exportBackup} type="button">Export encrypted backup</button>
              <button className="btn-secondary" disabled={backupPassword.length < 12} onClick={() => backupInput.current?.click()} type="button">Restore encrypted backup</button>
            </div>
          </section>

          <section className="panel rounded-2xl p-6 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="eyebrow">KYC proof</p><h3 className="mt-2 text-xl font-bold">Bằng chứng xác minh</h3></div>
              <span className="rounded-full border border-line px-3 py-1 text-xs font-bold text-amber">{profile?.kycStatus || 'NONE'}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">Bản hiện tại chỉ nhận hash và chữ ký để đưa vào hàng chờ. Backend không tự xác nhận VERIFIED; cần quy trình reviewer riêng.</p>
            <textarea className="field mt-5 min-h-28 resize-y" placeholder="Nhập thông tin hoặc mã tham chiếu tài liệu cần ký..." value={statement} onChange={(event) => setStatement(event.target.value)} />
            <button className="btn-primary mt-4" disabled={!keyReady || ['PENDING', 'VERIFIED'].includes(profile?.kycStatus)} onClick={submitKyc}>Hash, ký và gửi xét duyệt</button>
          </section>
        </div>
      </div>
    </div>
  )
}
