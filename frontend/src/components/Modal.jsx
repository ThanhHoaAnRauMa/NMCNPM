export default function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <section className="panel max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-3xl p-6 sm:p-8" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 className="font-display text-2xl">{title}</h2>
          <button aria-label="Đóng" className="grid h-9 w-9 place-items-center rounded-full border border-line text-slate-400 hover:text-paper" onClick={onClose}>×</button>
        </div>
        {children}
      </section>
    </div>
  )
}
