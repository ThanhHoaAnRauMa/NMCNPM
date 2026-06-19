import { useEffect, useState } from 'react'
import { createKycProof } from '../lib/crypto.js'

export default function ProfilePanel({ api, identity, onCreateIdentity, onProfileChanged }) {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ displayName: '', avatarUrl: '' })
  const [statement, setStatement] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

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
    if (!identity) return setError('Thiết bị cần có khóa ký trước khi gửi KYC.')
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
            <div className={`mt-6 rounded-xl border p-4 ${identity ? 'border-mint/30 bg-mint/10' : 'border-amber/30 bg-amber/10'}`}>
              <strong className={identity ? 'text-mint' : 'text-amber'}>{identity ? 'Thiết bị đã sẵn sàng' : 'Chưa có khóa trên thiết bị'}</strong>
              <p className="mt-2 text-xs leading-5 text-slate-400">{identity ? 'RSA-OAEP dùng bọc khóa tin nhắn, ECDSA P-256 dùng ký payload.' : 'Tạo khóa mới sẽ cập nhật public key tài khoản. Lịch sử mã hóa cho khóa cũ không thể giải mã bằng khóa mới.'}</p>
            </div>
            {!identity && <button className="btn-secondary mt-5 w-full" onClick={onCreateIdentity}>Tạo khóa cho thiết bị này</button>}
            <div className="mt-5 border-t border-line pt-5 text-xs leading-5 text-slate-500">Private key được lưu trong IndexedDB của trình duyệt và không xuất hiện trong request API.</div>
          </section>

          <section className="panel rounded-2xl p-6 lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="eyebrow">KYC proof</p><h3 className="mt-2 text-xl font-bold">Bằng chứng xác minh</h3></div>
              <span className="rounded-full border border-line px-3 py-1 text-xs font-bold text-amber">{profile?.kycStatus || 'NONE'}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-400">Bản hiện tại chỉ nhận hash và chữ ký để đưa vào hàng chờ. Backend không tự xác nhận VERIFIED; cần quy trình reviewer riêng.</p>
            <textarea className="field mt-5 min-h-28 resize-y" placeholder="Nhập thông tin hoặc mã tham chiếu tài liệu cần ký..." value={statement} onChange={(event) => setStatement(event.target.value)} />
            <button className="btn-primary mt-4" disabled={!identity || ['PENDING', 'VERIFIED'].includes(profile?.kycStatus)} onClick={submitKyc}>Hash, ký và gửi xét duyệt</button>
          </section>
        </div>
      </div>
    </div>
  )
}
