import KycBadge from './KycBadge.jsx'
import { conversationPeer, conversationTitle, displayName, shortTime } from '../lib/format.js'

function initials(value) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

export default function Sidebar({
  blockedUserIds,
  user,
  conversations,
  selectedId,
  onSelect,
  view,
  onView,
  onNew,
  onArchive,
  onDelete,
  onToggleArchived,
  onLogout,
  keyReady,
  showArchived,
}) {
  const totalUnread = conversations.reduce((total, conversation) => total + Number(conversation.unreadCount || 0), 0)
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
        <button className="btn-primary mt-5 w-full" onClick={onNew} type="button">+ Cuộc trò chuyện mới</button>
        <button className="btn-secondary mt-2 w-full" onClick={onToggleArchived} type="button">{showArchived ? 'Ẩn lưu trữ' : 'Xem lưu trữ'}</button>
      </div>

      <nav className="flex gap-1 border-b border-line px-4 py-3 text-xs">
        {[
          ['chat', 'Trò chuyện'],
          ['profile', 'Hồ sơ'],
          ['forensics', 'Forensics'],
        ].map(([id, label]) => (
          <button className={`flex-1 rounded-lg px-2 py-2 font-semibold transition ${view === id ? 'bg-white/10 text-paper' : 'text-slate-500 hover:text-paper'}`} key={id} onClick={() => onView(id)} type="button">
            <span className="inline-flex items-center justify-center gap-1.5">
              <span>{label}</span>
              {id === 'chat' && totalUnread > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-amber px-1.5 py-0.5 text-[10px] font-black text-ink">{totalUnread > 99 ? '99+' : totalUnread}</span>}
            </span>
          </button>
        ))}
      </nav>

      <div className="scrollbar min-h-0 flex-1 overflow-y-auto py-2">
        {conversations.length === 0 && (
          <div className="px-6 py-10 text-center text-sm leading-6 text-slate-500">
            {showArchived ? 'Chưa có hội thoại lưu trữ.' : 'Chưa có hội thoại. Tìm một người dùng hoặc tạo nhóm để bắt đầu.'}
          </div>
        )}
        {conversations.map((conversation) => {
          const peer = conversationPeer(conversation, user.id)
          const title = conversationTitle(conversation, user.id)
          const active = selectedId === conversation._id && view === 'chat'
          const last = conversation.lastMessage
          const unreadCount = Number(conversation.unreadCount || 0)
          const blocked = peer && blockedUserIds?.has(String(peer._id || peer.id))
          return (
            <article className={`border-l-2 px-4 py-3 transition ${active ? 'border-mint bg-mint/10' : unreadCount ? 'border-amber bg-amber/10' : 'border-transparent hover:bg-white/[.035]'}`} key={conversation._id}>
              <button className="flex w-full items-center gap-3 text-left" onClick={() => onSelect(conversation._id)} type="button">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-ink text-xs font-bold text-amber">{initials(title)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0 flex items-center gap-1.5">
                      <span className={`truncate text-sm font-semibold ${unreadCount ? 'text-paper' : ''}`}>{title}</span>
                      <KycBadge user={peer} />
                      {blocked && <span className="rounded bg-red-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-200">Đã chặn</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {unreadCount > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-amber px-1.5 py-0.5 text-[10px] font-black text-ink">{unreadCount > 99 ? '99+' : unreadCount}</span>}
                      <span className="text-[10px] text-slate-600">{shortTime(last?.createdAt || conversation.updatedAt)}</span>
                    </span>
                  </span>
                  <span className={`mt-1 flex items-center gap-2 text-[11px] ${unreadCount ? 'font-semibold text-slate-300' : 'text-slate-500'}`}>
                    <span className={`rounded px-1.5 py-0.5 ${['PRIVACY', 'Privacy'].includes(conversation.mode) ? 'bg-amber/10 text-amber' : 'bg-mint/10 text-mint'}`}>
                      {['PRIVACY', 'Privacy'].includes(conversation.mode) ? 'Privacy' : 'KYC'}
                    </span>
                    {conversation.archived && <span className="rounded bg-white/10 px-1.5 py-0.5 text-slate-300">Lưu trữ</span>}
                    <span className="truncate">{last ? (last.msgType === 'FILE' ? 'Tệp đã mã hóa' : 'Tin nhắn đã mã hóa') : 'Chưa có tin nhắn'}</span>
                  </span>
                </span>
              </button>
              <div className="mt-2 flex gap-2 pl-[52px] text-[10px]">
                <button className="rounded-lg border border-line px-2 py-1 text-slate-400 hover:border-mint/40 hover:text-paper" onClick={() => onArchive(conversation._id, !conversation.archived)} type="button">{conversation.archived ? 'Bỏ lưu trữ' : 'Lưu trữ'}</button>
                <button className="rounded-lg border border-red-400/20 px-2 py-1 text-red-200 hover:bg-red-400/10" onClick={() => onDelete(conversation._id)} type="button">Xóa</button>
              </div>
            </article>
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
        <button className="text-xs text-slate-500 hover:text-red-300" onClick={onLogout} type="button">Thoát</button>
      </div>
    </aside>
  )
}
