const toneClass = {
  success: 'border-mint/30 bg-[#12332c] text-mint',
  error: 'border-red-400/30 bg-[#351a24] text-red-100',
  warning: 'border-amber/30 bg-[#3a2b16] text-amber',
  info: 'border-line bg-panel text-slate-200',
}

export default function ToastStack({ toasts = [], onDismiss }) {
  if (!toasts.length) return null

  return (
    <div className="fixed right-4 top-4 z-[90] flex w-[min(92vw,380px)] flex-col gap-3">
      {toasts.map((toast) => (
        <article className={`rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur ${toneClass[toast.type] || toneClass.info}`} key={toast.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {toast.title && <p className="text-xs font-black uppercase tracking-[0.2em] opacity-80">{toast.title}</p>}
              <p className={`${toast.title ? 'mt-1' : ''} text-sm leading-5`}>{toast.message}</p>
            </div>
            <button className="shrink-0 text-lg leading-none opacity-70 hover:opacity-100" onClick={() => onDismiss(toast.id)} type="button">×</button>
          </div>
        </article>
      ))}
    </div>
  )
}
