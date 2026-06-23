import KycBadge from './KycBadge.jsx'
import { conversationPeer, conversationTitle, displayName, shortTime, userId } from '../lib/format.js'

function initials(value) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export default function Sidebar({ user, conversations, selectedId, onSelect, view, onView, onNew, onLogout, keyReady }) {
  return (
    <aside className="panel flex h-full min-h-0 flex-col rounded-none border-y-0 border-l-0 lg:rounded-l-3xl lg:border-y lg:border-l">
      <div className="border-b border-line p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Secure workspace</p>
            <h1 className="mt-2 font-display text-2xl">Forensis</h1>
          </div>
          <span className={`h-2.5 w-2.5 rounded-full ${keyReady ? 'bg-mint shadow-[0_0_12px_#6dd3b2]' : 'bg-amber'}`} title={keyReady ? 'Khóa thiết bị sẵn sàng' : 'Chưa có khóa thiết bị'} />
        </div>
        <button className="btn-primary mt-5 w-full" onClick={onNew}>+ Cuộc trò chuyện mới</button>
      </div>

      <nav className="flex gap-1 border-b border-line px-4 py-3 text-xs">
        {[
          ['chat', 'Trò chuyện'],
          ['profile', 'Hồ sơ'],
          ['forensics', 'Forensics'],
        ].map(([id, label]) => (
          <button className={`flex-1 rounded-lg px-2 py-2 font-semibold transition ${view === id ? 'bg-white/10 text-paper' : 'text-slate-500 hover:text-paper'}`} key={id} onClick={() => onView(id)}>{label}</button>
        ))}
      </nav>

      <div className="scrollbar min-h-0 flex-1 overflow-y-auto py-2">
        {conversations.length === 0 && (
          <div className="px-6 py-10 text-center text-sm leading-6 text-slate-500">
            Chưa có hội thoại. Tìm một người dùng hoặc tạo nhóm để bắt đầu.
          </div>
        )}
        {conversations.map((conversation) => {
          const peer = conversationPeer(conversation, user.id)
          const title = conversationTitle(conversation, user.id)
          const active = selectedId === conversation._id && view === 'chat'
          const last = conversation.lastMessage
          return (
            <button className={`flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition ${active ? 'border-mint bg-mint/10' : 'border-transparent hover:bg-white/[.035]'}`} key={conversation._id} onClick={() => onSelect(conversation._id)}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-ink text-xs font-bold text-amber">{initials(title)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{title}</span>
                    <KycBadge user={peer} />
                  </span>
                  <span className="shrink-0 text-[10px] text-slate-600">{shortTime(last?.createdAt || conversation.updatedAt)}</span>
                </span>
                <span className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                  <span className={`rounded px-1.5 py-0.5 ${['PRIVACY', 'Privacy'].includes(conversation.mode) ? 'bg-amber/10 text-amber' : 'bg-mint/10 text-mint'}`}>
                    {['PRIVACY', 'Privacy'].includes(conversation.mode) ? 'Privacy' : 'KYC'}
                  </span>
                  <span className="truncate">{last ? (last.msgType === 'FILE' ? 'Tệp đã mã hóa' : 'Tin nhắn đã mã hóa') : 'Chưa có tin nhắn'}</span>
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-3 border-t border-line p-4">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-amber text-xs font-black text-ink">{initials(displayName(user))}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="block truncate text-sm font-semibold">{displayName(user)}</span>
            <KycBadge user={user} />
          </span>
          <span className="block truncate text-[11px] text-slate-500">{user.email}</span>
        </span>
        <button className="text-xs text-slate-500 hover:text-red-300" onClick={onLogout}>Thoát</button>
      </div>
    </aside>
  )
}
