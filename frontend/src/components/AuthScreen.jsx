import { useEffect, useMemo, useState } from 'react'
import { API_URL, ApiError } from '../lib/api.js'

async function authRequest(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(payload.message || 'Không thể xử lý yêu cầu.', response.status, payload)
  return payload
}

export default function AuthScreen({ authenticate }) {
  const initialResetToken = useMemo(() => new URLSearchParams(window.location.search).get('resetToken') || '', [])
  const [mode, setMode] = useState(initialResetToken ? 'reset' : 'login')
  const [form, setForm] = useState({
    username: '',
    email: '',
    identifier: '',
    password: '',
    confirmPassword: '',
    emailOtp: '',
    resetToken: initialResetToken,
    newPassword: '',
    confirmNewPassword: '',
  })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 5000)
    fetch(`${API_URL}/health`, { signal: controller.signal }).catch(() => {}).finally(() => window.clearTimeout(timeout))
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setNotice('')
  }

  const sendOtp = async () => {
    setError('')
    setNotice('')
    if (!form.email) {
      setError('Nhập email trước khi gửi OTP.')
      return
    }
    setOtpLoading(true)
    try {
      const payload = await authRequest('/auth/email-otp', { email: form.email })
      setNotice(payload.debugOtp ? `OTP đã gửi. Mã debug: ${payload.debugOtp}` : 'OTP đã được gửi tới email của bạn.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setOtpLoading(false)
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (mode === 'register' && form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }
    if (mode === 'reset' && form.newPassword !== form.confirmNewPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'register') {
        await authenticate('register', {
          username: form.username,
          email: form.email,
          password: form.password,
          confirmPassword: form.confirmPassword,
          emailOtp: form.emailOtp,
        })
      } else if (mode === 'login') {
        await authenticate('login', { identifier: form.identifier, password: form.password })
      } else if (mode === 'forgot') {
        const payload = await authRequest('/auth/forgot-password', { identifier: form.identifier })
        setNotice(payload.debugResetToken ? `${payload.message} Token debug: ${payload.debugResetToken}` : payload.message)
        if (payload.debugResetToken) setForm((current) => ({ ...current, resetToken: payload.debugResetToken }))
        setMode('reset')
      } else if (mode === 'reset') {
        const payload = await authRequest('/auth/reset-password', {
          token: form.resetToken,
          password: form.newPassword,
          confirmPassword: form.confirmNewPassword,
        })
        setNotice(payload.message)
        setMode('login')
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
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
            ['03', 'Evidence', 'Merkle root xác nhận tính toàn vẹn'],
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
            <h2 className="mt-3 font-display text-3xl">
              {mode === 'login' && 'Chào mừng trở lại'}
              {mode === 'register' && 'Tạo danh tính mới'}
              {mode === 'forgot' && 'Lấy lại mật khẩu'}
              {mode === 'reset' && 'Đặt lại mật khẩu'}
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              {mode === 'login' && 'Tiếp tục vào không gian hội thoại của bạn.'}
              {mode === 'register' && 'Xác minh email bằng OTP trước khi đăng ký.'}
              {mode === 'forgot' && 'Nhập email hoặc username để nhận link đặt lại mật khẩu.'}
              {mode === 'reset' && 'Nhập token trong email và mật khẩu mới.'}
            </p>

            <form className="mt-8 space-y-4" onSubmit={submit}>
              {mode === 'register' && (
                <>
                  <label className="block text-xs font-semibold text-slate-300">
                    Username
                    <input className="field mt-2" minLength={3} maxLength={64} required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-300">
                    Email
                    <div className="mt-2 flex gap-2">
                      <input className="field" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                      <button className="btn-secondary shrink-0" disabled={otpLoading} onClick={sendOtp} type="button">{otpLoading ? 'Đang gửi...' : 'Gửi OTP'}</button>
                    </div>
                  </label>
                  <label className="block text-xs font-semibold text-slate-300">
                    OTP email
                    <input className="field mt-2 tracking-[0.35em]" inputMode="numeric" maxLength={6} minLength={6} pattern="\d{6}" required value={form.emailOtp} onChange={(event) => setForm({ ...form, emailOtp: event.target.value.replace(/\D/g, '').slice(0, 6) })} />
                  </label>
                </>
              )}

              {mode === 'login' && (
                <label className="block text-xs font-semibold text-slate-300">
                  Username hoặc email
                  <input autoCapitalize="none" autoComplete="username" className="field mt-2" maxLength={254} placeholder="username hoặc name@gmail.com" required spellCheck={false} value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} />
                </label>
              )}

              {mode === 'forgot' && (
                <label className="block text-xs font-semibold text-slate-300">
                  Email hoặc username
                  <input autoCapitalize="none" className="field mt-2" maxLength={254} required spellCheck={false} value={form.identifier} onChange={(event) => setForm({ ...form, identifier: event.target.value })} />
                </label>
              )}

              {['login', 'register'].includes(mode) && (
                <label className="block text-xs font-semibold text-slate-300">
                  Mật khẩu
                  <input autoComplete={mode === 'register' ? 'new-password' : 'current-password'} className="field mt-2" type="password" minLength={8} maxLength={72} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                </label>
              )}
              {mode === 'register' && (
                <label className="block text-xs font-semibold text-slate-300">
                  Xác nhận mật khẩu
                  <input autoComplete="new-password" className="field mt-2" type="password" minLength={8} maxLength={72} required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />
                </label>
              )}

              {mode === 'reset' && (
                <>
                  <label className="block text-xs font-semibold text-slate-300">
                    Reset token
                    <input className="field mt-2 font-mono text-xs" required value={form.resetToken} onChange={(event) => setForm({ ...form, resetToken: event.target.value })} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-300">
                    Mật khẩu mới
                    <input autoComplete="new-password" className="field mt-2" type="password" minLength={8} maxLength={72} required value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} />
                  </label>
                  <label className="block text-xs font-semibold text-slate-300">
                    Xác nhận mật khẩu mới
                    <input autoComplete="new-password" className="field mt-2" type="password" minLength={8} maxLength={72} required value={form.confirmNewPassword} onChange={(event) => setForm({ ...form, confirmNewPassword: event.target.value })} />
                  </label>
                </>
              )}

              {notice && <p className="rounded-xl border border-mint/30 bg-mint/10 px-4 py-3 text-sm text-mint">{notice}</p>}
              {error && <p className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
              <button className="btn-primary mt-2 w-full" disabled={loading} type="submit">
                {loading && 'Đang xử lý...'}
                {!loading && mode === 'login' && 'Đăng nhập'}
                {!loading && mode === 'register' && 'Đăng ký và tiếp tục'}
                {!loading && mode === 'forgot' && 'Gửi link đặt lại'}
                {!loading && mode === 'reset' && 'Đặt lại mật khẩu'}
              </button>
            </form>

            <div className="mt-6 space-y-3 text-center text-sm">
              {mode !== 'login' && <button className="w-full text-slate-400 hover:text-paper" onClick={() => switchMode('login')} type="button">Quay lại đăng nhập</button>}
              {mode === 'login' && <button className="w-full text-slate-400 hover:text-paper" onClick={() => switchMode('register')} type="button">Chưa có tài khoản? Đăng ký</button>}
              {mode === 'login' && <button className="w-full text-slate-500 hover:text-paper" onClick={() => switchMode('forgot')} type="button">Quên mật khẩu?</button>}
              {mode === 'register' && <button className="w-full text-slate-400 hover:text-paper" onClick={() => switchMode('login')} type="button">Đã có tài khoản? Đăng nhập</button>}
              {mode === 'forgot' && <button className="w-full text-slate-500 hover:text-paper" onClick={() => switchMode('reset')} type="button">Đã có token? Đặt lại mật khẩu</button>}
            </div>
          </div>
          <p className="mt-5 text-center text-[11px] leading-5 text-slate-600">
            Khóa riêng không được gửi lên máy chủ. Xóa dữ liệu trình duyệt có thể làm mất khả năng giải mã lịch sử trên thiết bị này.
          </p>
        </div>
      </section>
    </main>
  )
}
