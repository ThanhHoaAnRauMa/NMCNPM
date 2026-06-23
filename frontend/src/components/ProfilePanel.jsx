import { useEffect, useRef, useState } from 'react'
import KycBadge from './KycBadge.jsx'
import { createKycDocumentProof } from '../lib/crypto.js'
import { createIdentityBackup, restoreIdentityBackup } from '../lib/keyBackup.js'

export default function ProfilePanel({ api, identity, keyStatus, onCreateIdentity, onProfileChanged, onRestoreIdentity, onSynchronizeIdentity, userId }) {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ displayName: '', avatarUrl: '' })
  const [kycForm, setKycForm] = useState({ fullName: '', citizenId: '', dateOfBirth: '', address: '' })
  const [kycFiles, setKycFiles] = useState({ front: null, back: null })
  const [reviewRecords, setReviewRecords] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [kycDialog, setKycDialog] = useState('')
  const [backupPassword, setBackupPassword] = useState('')
  const backupInput = useRef(null)
  const keyReady = Boolean(identity) && keyStatus === 'ready'
  const kycStatus = String(profile?.kycStatus || 'NONE').toUpperCase()
  const kycReviewLocked = ['PENDING', 'VERIFIED'].includes(kycStatus)
  const kycPanelMessage = {
    PENDING: 'Đã gửi hồ sơ KYC. Hồ sơ đang chờ reviewer đối chiếu và duyệt.',
    VERIFIED: 'Tài khoản đã xác minh KYC thành công. Bạn có thể dùng KYC mode.',
    REJECTED: 'Hồ sơ KYC trước đó đã bị từ chối. Bạn có thể chỉnh thông tin và gửi lại.',
  }[kycStatus]
  const kycSubmitLabel = {
    PENDING: 'Đã gửi, đang chờ duyệt',
    VERIFIED: 'Đã xác minh KYC',
  }[kycStatus] || 'Ký và gửi hồ sơ KYC'

  const kycKeyGuidance = () => {
    if (keyStatus === 'loading') return 'Đang kiểm tra khóa thiết bị, thử lại sau vài giây.'
    if (keyStatus === 'missing') return 'Bạn cần tạo khóa thiết bị trước khi ký hồ sơ KYC.'
    if (keyStatus === 'remote-only') return 'Tài khoản đã có khóa trên thiết bị khác. Hãy restore backup hoặc thay thế khóa trong mục Device key.'
    if (keyStatus === 'local-only') return 'Khóa cục bộ chưa được đồng bộ với tài khoản. Bấm "Dùng khóa thiết bị này cho tài khoản" trước khi gửi KYC.'
    if (keyStatus === 'mismatch') return 'Khóa thiết bị không khớp tài khoản. Hãy restore backup hoặc đồng bộ khóa trong mục Device key trước khi gửi KYC.'
    if (keyStatus === 'error') return 'Không xác minh được trạng thái khóa thiết bị. Hãy tải lại trang hoặc đăng nhập lại.'
    return 'Khóa thiết bị phải khớp tài khoản trước khi gửi KYC.'
  }

  const showKycError = (message) => {
    setError(message)
    setKycDialog(message)
  }

  useEffect(() => {
    api.get('/users/me').then(({ user }) => {
      setProfile(user)
      setForm({ displayName: user.displayName || '', avatarUrl: user.avatarUrl || '' })
    }).catch((requestError) => setError(requestError.message))
    api.get('/kyc/reviews').then(({ records }) => setReviewRecords(records)).catch((requestError) => {
      if (requestError.status !== 403) setError(requestError.message)
    })
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
    setKycDialog('')
    if (kycReviewLocked) return showKycError(kycStatus === 'PENDING' ? 'Hồ sơ KYC đang chờ reviewer duyệt.' : 'Tài khoản đã xác minh KYC.')
    if (!keyReady) return showKycError(kycKeyGuidance())
    if (kycForm.fullName.trim().length < 2 || !/^\d{12}$/.test(kycForm.citizenId) || !kycForm.dateOfBirth || kycForm.address.trim().length < 5) return showKycError('Vui lòng nhập đầy đủ thông tin CCCD hợp lệ.')
    if (!kycFiles.front || !kycFiles.back) return showKycError('Cần ảnh mặt trước và mặt sau CCCD.')
    try {
      const proof = await createKycDocumentProof(kycForm, kycFiles.front, kycFiles.back, identity)
      const formData = new FormData()
      Object.entries({ ...kycForm, ...proof, pubkey: identity.publicBundle }).forEach(([key, value]) => formData.append(key, value))
      formData.append('documentFront', kycFiles.front)
      formData.append('documentBack', kycFiles.back)
      const payload = await api.upload('/kyc/submit', formData)
      setProfile((current) => ({ ...current, kycStatus: payload.kycRecord.status }))
      setNotice('Hồ sơ KYC đã gửi và đang chờ reviewer đối chiếu.')
      setKycDialog('')
      setKycFiles({ front: null, back: null })
    } catch (requestError) {
      showKycError(requestError.message)
    }
  }

  const reviewKyc = async (recordId, status) => {
    const rejectionReason = status === 'REJECTED' ? window.prompt('Lý do từ chối (ít nhất 5 ký tự):') : ''
    if (status === 'REJECTED' && (!rejectionReason || rejectionReason.trim().length < 5)) return
    try {
      await api.patch(`/kyc/reviews/${recordId}`, { status, rejectionReason })
      setReviewRecords((records) => records.filter((record) => record._id !== recordId))
      setNotice(`Đã cập nhật hồ sơ thành ${status}.`)
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
        {kycDialog && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-2xl border border-red-400/30 bg-panel p-6 shadow-2xl">
              <p className="eyebrow text-red-200">KYC proof</p>
              <h3 className="mt-2 text-xl font-bold text-paper">Không thể gửi hồ sơ KYC</h3>
              <p className="mt-3 text-sm leading-6 text-red-100">{kycDialog}</p>
              <button className="btn-primary mt-5 w-full" onClick={() => setKycDialog('')} type="button">Đã hiểu</button>
            </div>
          </div>
        )}

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <form className="panel rounded-2xl p-6" onSubmit={save}>
            <p className="eyebrow">Public profile</p>
            <h3 className="mt-2 text-xl font-bold">Thông tin hiển thị</h3>
            <label className="mt-6 block text-xs font-semibold text-slate-300">Tên hiển thị<input className="field mt-2" maxLength={80} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
            <label className="mt-4 block text-xs font-semibold text-slate-300">Avatar URL<input className="field mt-2" type="url" value={form.avatarUrl} onChange={(event) => setForm({ ...form, avatarUrl: event.target.value })} /></label>
            <div className="mt-5 rounded-xl bg-ink/60 p-4 text-xs leading-6 text-slate-400">
              <div className="flex justify-between gap-3">
                <span>Username</span>
                <strong className="flex min-w-0 items-center gap-1.5 text-paper">
                  <span className="truncate">@{profile?.username || '...'}</span>
                  <KycBadge user={profile} />
                </strong>
              </div>
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
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-bold text-amber">
                <KycBadge user={profile} />
                {profile?.kycStatus || 'NONE'}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">KYC là tùy chọn sau đăng ký. Reviewer được cấp quyền sẽ đối chiếu thông tin và hai ảnh CCCD lưu private trên Cloudinary. Chỉ tài khoản VERIFIED mới dùng KYC mode.</p>
            {kycPanelMessage && (
              <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${kycStatus === 'REJECTED' ? 'border-amber/30 bg-amber/10 text-amber' : 'border-mint/30 bg-mint/10 text-mint'}`}>
                {kycPanelMessage}
              </div>
            )}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-300">Họ và tên<input className="field mt-2" maxLength={120} required value={kycForm.fullName} onChange={(event) => setKycForm({ ...kycForm, fullName: event.target.value })} /></label>
              <label className="text-xs font-semibold text-slate-300">Số CCCD<input className="field mt-2" inputMode="numeric" maxLength={12} minLength={12} pattern="[0-9]{12}" required value={kycForm.citizenId} onChange={(event) => setKycForm({ ...kycForm, citizenId: event.target.value.replace(/\D/g, '') })} /></label>
              <label className="text-xs font-semibold text-slate-300">Ngày sinh<input className="field mt-2" type="date" required value={kycForm.dateOfBirth} onChange={(event) => setKycForm({ ...kycForm, dateOfBirth: event.target.value })} /></label>
              <label className="text-xs font-semibold text-slate-300">Địa chỉ<input className="field mt-2" maxLength={500} required value={kycForm.address} onChange={(event) => setKycForm({ ...kycForm, address: event.target.value })} /></label>
              <label className="text-xs font-semibold text-slate-300">Ảnh mặt trước<input accept="image/jpeg,image/png,image/webp" className="field mt-2" type="file" onChange={(event) => setKycFiles({ ...kycFiles, front: event.target.files?.[0] || null })} /></label>
              <label className="text-xs font-semibold text-slate-300">Ảnh mặt sau<input accept="image/jpeg,image/png,image/webp" className="field mt-2" type="file" onChange={(event) => setKycFiles({ ...kycFiles, back: event.target.files?.[0] || null })} /></label>
            </div>
            {!keyReady && !kycReviewLocked && <p className="mt-3 text-xs leading-5 text-amber">{kycKeyGuidance()}</p>}
            <button className="btn-primary mt-4" disabled={kycReviewLocked} onClick={submitKyc} type="button">{kycSubmitLabel}</button>
          </section>

          {reviewRecords && <section className="panel rounded-2xl p-6 lg:col-span-2">
            <p className="eyebrow">Reviewer queue</p><h3 className="mt-2 text-xl font-bold">Hồ sơ KYC chờ duyệt</h3>
            <div className="mt-5 space-y-4">{reviewRecords.length === 0 ? <p className="text-sm text-slate-500">Không có hồ sơ đang chờ.</p> : reviewRecords.map((record) => <article className="rounded-xl border border-line p-4" key={record._id}>
              <div className="rounded-xl border border-mint/20 bg-mint/5 p-3 text-xs leading-5 text-slate-300">
                <p className="font-bold uppercase tracking-wider text-mint">Tài khoản gửi</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <span><strong className="text-paper">Email:</strong> {record.userId?.email || 'Không có email'}</span>
                  <span><strong className="text-paper">Username:</strong> @{record.userId?.username || 'unknown'}</span>
                  <span><strong className="text-paper">Tên hiển thị:</strong> {record.userId?.displayName || 'Chưa đặt'}</span>
                  <span><strong className="text-paper">Trạng thái:</strong> {record.userId?.kycStatus || 'UNKNOWN'}</span>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><strong>{record.fullName || 'Legacy proof'}</strong><span>{record.citizenId || 'Không có số CCCD'}</span><span>{record.dateOfBirth ? new Date(record.dateOfBirth).toLocaleDateString('vi-VN') : ''}</span><span>{record.address}</span></div>
              {record.documents ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><a href={record.documents.frontUrl} rel="noreferrer" target="_blank"><img alt="CCCD mặt trước" className="max-h-64 w-full rounded-lg object-contain" src={record.documents.frontUrl} /></a><a href={record.documents.backUrl} rel="noreferrer" target="_blank"><img alt="CCCD mặt sau" className="max-h-64 w-full rounded-lg object-contain" src={record.documents.backUrl} /></a></div> : <p className="mt-3 text-xs text-amber">Legacy proof không có ảnh; nên từ chối và yêu cầu gửi lại.</p>}
              <div className="mt-4 flex gap-2"><button className="btn-primary" disabled={!record.documents} onClick={() => reviewKyc(record._id, 'VERIFIED')}>Duyệt</button><button className="btn-secondary" onClick={() => reviewKyc(record._id, 'REJECTED')}>Từ chối</button></div>
            </article>)}</div>
          </section>}
        </div>
      </div>
    </div>
  )
}
