import { useEffect, useState } from 'react'
import { API_URL } from '../lib/api.js'

export default function AuthScreen({ authenticate }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', email: '', identifier: '', password: '', confirmPassword: '', otp: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [devOtp, setDevOtp] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 5000)
    fetch(`${API_URL}/health`, { signal: controller.signal }).catch(() => {}).finally(() => window.clearTimeout(timeout))
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (mode === 'register' && form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }
    setLoading(true)
    try {
      if (mode === 'register' && otpSent) {
        await authenticate('register/verify', { email: pendingEmail, otp: form.otp })
        return
      }

      const payload = mode === 'register'
        ? { username: form.username, email: form.email, password: form.password, confirmPassword: form.confirmPassword }
        : { identifier: form.identifier, password: form.password }
      if (mode === 'register') {
        const response = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.message || 'Unable to send OTP.')
        setPendingEmail(payload.email.trim().toLowerCase())
        setDevOtp(result.devOtp || '')
        setOtpSent(true)
      } else {
        await authenticate(mode, payload)
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
    setOtpSent(false)
    setPendingEmail('')
    setDevOtp('')
    setForm({ username: '', email: '', identifier: '', password: '', confirmPassword: '', otp: '' })
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.15fr_.85fr]">
      <section className="relative hidden overflow-hidden border-r border-line/70 p-14 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full border border-mint/15" />
        <div className="absolute -left-20 top-[38%] h-72 w-72 rounded-full border border-mint/10" />
        <div className="relative">
          <p className="eyebrow">Secure Chat Forensics</p>
          <h1 className="mt-7 max-w-2xl font-display text-6xl leading-[1.02] text-paper">
            Riêng tư khi trò chuyện. <span className="text-amber">Kiểm chứng</span> khi cần thiết.
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-slate-400">
            Tin nhắn được mã hóa trên thiết bị, ký số theo từng bản ghi và liên kết với bằng chứng Merkle mà không giao plaintext cho máy chủ.
          </p>
        </div>
        <div className="relative grid max-w-2xl grid-cols-3 gap-3">
          {[
            ['01', 'Client-side', 'Mã hóa và khóa riêng nằm trên thiết bị'],
            ['02', 'Forensic log', 'Chữ ký giữ nguyên nguồn gốc bản ghi'],
            ['03', 'On-chain', 'Merkle root xác nhận tính toàn vẹn'],
          ].map(([number, title, copy]) => (
            <article className="border-t border-line pt-4" key={number}>
              <span className="font-mono text-xs text-mint">{number}</span>
              <h2 className="mt-3 text-sm font-bold">{title}</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <p className="eyebrow">Secure Chat Forensics</p>
            <h1 className="mt-3 font-display text-4xl">Tin nhắn có thể kiểm chứng.</h1>
          </div>
          <div className="panel rounded-3xl p-7 sm:p-9">
            <p className="eyebrow">Truy cập an toàn</p>
            <h2 className="mt-3 font-display text-3xl">{mode === 'login' ? 'Chào mừng trở lại' : 'Tạo danh tính mới'}</h2>
            <p className="mt-2 text-sm text-slate-400">
              {mode === 'login' ? 'Tiếp tục vào không gian hội thoại của bạn.' : 'Khóa mã hóa sẽ được tạo cục bộ sau khi đăng ký.'}
            </p>

            <form className="mt-8 space-y-4" onSubmit={submit}>
              {mode === 'register' && (
                <label className="block text-xs font-semibold text-slate-300">
                  Username
                  <input className="field mt-2" disabled={otpSent} minLength={3} maxLength={64} required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
                </label>
              )}
              {mode === 'register' ? (
                <label className="block text-xs font-semibold text-slate-300">
                  Email
                  <input className="field mt-2" disabled={otpSent} type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                </label>
              ) : (
                <label className="block text-xs font-semibold text-slate-300">
                  Username hoặc email
                  <input autoCapitalize="none" autoComplete="username" className="field mt-2" maxLength={254} placeholder="username hoặc name@gmail.com" required spellCheck={false} value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} />
                </label>
              )}
              <label className="block text-xs font-semibold text-slate-300">
                Mật khẩu
                <input autoComplete={mode === 'register' ? 'new-password' : 'current-password'} className="field mt-2" disabled={otpSent} type="password" minLength={8} maxLength={72} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
              </label>
              {mode === 'register' && (
                <label className="block text-xs font-semibold text-slate-300">
                  Xác nhận mật khẩu
                  <input autoComplete="new-password" className="field mt-2" disabled={otpSent} type="password" minLength={8} maxLength={72} required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />
                </label>
              )}
              {mode === 'register' && otpSent && (
                <label className="block text-xs font-semibold text-slate-300">
                  OTP
                  <input autoComplete="one-time-code" className="field mt-2 tracking-[0.35em]" inputMode="numeric" maxLength={6} minLength={6} pattern="[0-9]{6}" required value={form.otp} onChange={(event) => setForm({ ...form, otp: event.target.value.replace(/\D/g, '').slice(0, 6) })} />
                  {devOtp && <span className="mt-2 block text-xs text-amber">Ma test local: {devOtp}</span>}
                </label>
              )}
              {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
              <button className="btn-primary mt-2 w-full" disabled={loading} type="submit">
                {loading ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : otpSent ? 'Xác nhận OTP' : 'Gửi mã OTP'}
              </button>
              {mode === 'register' && otpSent && (
                <button className="w-full text-center text-xs text-slate-400 hover:text-paper" onClick={() => { setOtpSent(false); setPendingEmail(''); setDevOtp(''); setForm({ ...form, otp: '' }) }} type="button">
                  Đổi thông tin đăng ký
                </button>
              )}
            </form>

            <button className="mt-6 w-full text-center text-sm text-slate-400 hover:text-paper" onClick={switchMode} type="button">
              {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
            </button>
          </div>
          <p className="mt-5 text-center text-[11px] leading-5 text-slate-600">
            Khóa riêng không được gửi lên máy chủ. Xóa dữ liệu trình duyệt có thể làm mất khả năng giải mã lịch sử trên thiết bị này.
          </p>
        </div>
      </section>
    </main>
  )
}
