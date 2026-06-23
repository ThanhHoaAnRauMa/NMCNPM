import { useCallback, useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import AuthScreen from './components/AuthScreen.jsx'
import ChatWorkspace from './components/ChatWorkspace.jsx'
import ForensicsPanel from './components/ForensicsPanel.jsx'
import NewConversationModal from './components/NewConversationModal.jsx'
import ProfilePanel from './components/ProfilePanel.jsx'
import Sidebar from './components/Sidebar.jsx'
import { useSession } from './hooks/useSession.js'
import { API_URL } from './lib/api.js'
import { generateIdentity } from './lib/crypto.js'
import { identityStatus as resolveIdentityStatus } from './lib/identityStatus.js'
import { loadIdentity, saveIdentity } from './lib/keyStore.js'

function conversationActivityTime(conversation) {
  const value = new Date(conversation?.lastMessage?.createdAt || conversation?.lastMessage?.timestamp || conversation?.updatedAt || conversation?.createdAt || 0).getTime()
  return Number.isNaN(value) ? 0 : value
}

function normalizeConversations(conversations = []) {
  return [...conversations].sort((left, right) =>
    conversationActivityTime(right) - conversationActivityTime(left) ||
    String(right._id).localeCompare(String(left._id)),
  )
}

function visibleConversations(conversations = [], showArchived = false) {
  const filtered = showArchived ? conversations.filter((conversation) => conversation.archived) : conversations
  return normalizeConversations(filtered)
}

export default function App() {
  const auth = useSession()
  const [identity, setIdentity] = useState(null)
  const [keyStatus, setKeyStatus] = useState('loading')
  const [serverPublicKey, setServerPublicKey] = useState(null)
  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [view, setView] = useState('chat')
  const [showNew, setShowNew] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [socket, setSocket] = useState(null)
  const [systemError, setSystemError] = useState('')
  const currentUserId = auth.session?.user?.id || auth.session?.user?._id

  const refreshConversations = useCallback(async (preferredId) => {
    if (!auth.session) return
    try {
      const payload = await auth.api.get(`/chat/conversations${showArchived ? '?includeArchived=true' : ''}`)
      const normalized = visibleConversations(payload.conversations, showArchived)
      setConversations(normalized)
      if (preferredId) setSelectedId(String(preferredId))
      else if (!selectedId && normalized.length) setSelectedId(String(normalized[0]._id))
    } catch (error) {
      setSystemError(error.message)
    }
  }, [auth.api, auth.session, selectedId, showArchived])

  useEffect(() => {
    if (!currentUserId) {
      setIdentity(null)
      setKeyStatus('loading')
      setServerPublicKey(null)
      return
    }
    let active = true
    Promise.all([loadIdentity(currentUserId), auth.api.get('/users/me')])
      .then(([localIdentity, { user }]) => {
        if (!active) return
        setIdentity(localIdentity || null)
        setServerPublicKey(user.publicKey || null)
        setKeyStatus(resolveIdentityStatus(localIdentity, user.publicKey))
      })
      .catch(() => {
        if (!active) return
        setKeyStatus('error')
        setSystemError('Không thể kiểm tra khóa thiết bị với máy chủ.')
      })
    return () => { active = false }
  }, [auth.api, currentUserId])

  useEffect(() => {
    if (!auth.session?.accessToken) return
    const connection = io(API_URL, {
      auth: { token: auth.session.accessToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 8,
    })
    const refreshFromRealtime = async () => {
      try {
        const payload = await auth.api.get(`/chat/conversations${showArchived ? '?includeArchived=true' : ''}`)
        setConversations(visibleConversations(payload.conversations, showArchived))
      } catch (error) {
        setSystemError(error.message)
      }
    }
    connection.on('connect_error', (error) => setSystemError(`Realtime: ${error.message}`))
    connection.on('connect', () => {
      setSystemError('')
      refreshFromRealtime()
    })
    connection.on('conversation_created', refreshFromRealtime)
    connection.on('conversation_updated', refreshFromRealtime)
    connection.on('user_key_updated', refreshFromRealtime)
    setSocket(connection)
    return () => {
      connection.disconnect()
      setSocket(null)
    }
  }, [auth.api, auth.session?.accessToken, showArchived])

  useEffect(() => {
    if (auth.session) refreshConversations()
  // Initial session load only; explicit mutations call refreshConversations.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(auth.session)])

  useEffect(() => {
    if (auth.session) refreshConversations()
  }, [auth.session, refreshConversations, showArchived])

  const selectedConversation = useMemo(() => conversations.find((conversation) => String(conversation._id) === String(selectedId)) || null, [conversations, selectedId])

  const createDeviceIdentity = async ({ replace = false } = {}) => {
    setSystemError('')
    try {
      if (serverPublicKey && !replace) throw new Error('Tài khoản đã có khóa công khai. Hãy restore backup hoặc xác nhận thay thế khóa trong Hồ sơ.')
      const generated = await generateIdentity()
      await auth.api.post('/users/pubkey', { publicKey: generated.publicBundle })
      await saveIdentity(currentUserId, generated)
      setIdentity({ userId: currentUserId, ...generated })
      setServerPublicKey(generated.publicBundle)
      setKeyStatus('ready')
      await refreshConversations(selectedId)
    } catch (error) {
      setSystemError(`Không tạo được khóa thiết bị: ${error.message}`)
    }
  }

  const restoreDeviceIdentity = async (restored) => {
    await auth.api.post('/users/pubkey', { publicKey: restored.publicBundle })
    await saveIdentity(currentUserId, restored)
    setIdentity({ userId: currentUserId, ...restored })
    setServerPublicKey(restored.publicBundle)
    setKeyStatus('ready')
    await refreshConversations(selectedId)
  }

  const synchronizeDeviceIdentity = async () => {
    if (!identity) throw new Error('Thiết bị không có khóa cục bộ để đồng bộ.')
    await auth.api.post('/users/pubkey', { publicKey: identity.publicBundle })
    setServerPublicKey(identity.publicBundle)
    setKeyStatus('ready')
    await refreshConversations(selectedId)
  }

  const handleKeyMismatch = () => {
    setKeyStatus('mismatch')
    setSystemError('Khóa thiết bị không còn khớp tài khoản. Tin nhắn chưa được gửi; mở Hồ sơ để restore hoặc đồng bộ khóa.')
  }

  const handleConversationActivity = useCallback((conversationId, lastMessage) => {
    if (!conversationId || !lastMessage) return
    const activityAt = lastMessage.createdAt || lastMessage.timestamp || new Date().toISOString()
    setConversations((current) => normalizeConversations(current.map((conversation) => (
      String(conversation._id) === String(conversationId)
        ? { ...conversation, lastMessage: { ...lastMessage, conversationId }, updatedAt: activityAt }
        : conversation
    ))))
  }, [])

  const handleArchiveConversation = async (conversationId, archived) => {
    setSystemError('')
    try {
      await auth.api.patch(`/chat/conversations/${conversationId}/archive`, { archived })
      if (String(selectedId) === String(conversationId) && archived && !showArchived) setSelectedId(null)
      await refreshConversations()
    } catch (error) {
      setSystemError(error.message)
    }
  }

  const handleDeleteConversation = async (conversationId) => {
    if (!window.confirm('Xóa cuộc trò chuyện khỏi danh sách của bạn? Tin nhắn forensic/persisted không bị xóa khỏi hệ thống.')) return
    setSystemError('')
    try {
      await auth.api.delete(`/chat/conversations/${conversationId}`)
      setConversations((current) => current.filter((conversation) => String(conversation._id) !== String(conversationId)))
      if (String(selectedId) === String(conversationId)) setSelectedId(null)
      await refreshConversations()
    } catch (error) {
      setSystemError(error.message)
    }
  }

  const handleConversationCreated = async (conversationId) => {
    setShowArchived(false)
    try {
      const payload = await auth.api.get('/chat/conversations')
      setConversations(visibleConversations(payload.conversations, false))
      setSelectedId(String(conversationId))
      setView('chat')
    } catch (error) {
      setSystemError(error.message)
    }
  }

  const updateSessionUser = (user) => {
    auth.setSession({ ...auth.session, user: { ...auth.session.user, ...user, id: user.id || user._id } })
  }

  if (!auth.session) return <AuthScreen authenticate={auth.authenticate} />

  const contentOpen = view !== 'chat' || Boolean(selectedId)
  const keyWarning = {
    missing: 'Thiết bị chưa có khóa riêng.',
    'remote-only': 'Tài khoản đã có khóa trên thiết bị khác. Hãy restore backup hoặc chủ động thay thế khóa.',
    'local-only': 'Khóa cục bộ chưa được đồng bộ với tài khoản.',
    mismatch: 'Khóa cục bộ không khớp public key của tài khoản. Gửi tin đã bị khóa để tránh signature fail.',
    error: 'Không xác minh được trạng thái khóa thiết bị.',
  }[keyStatus]

  return (
    <main className="h-screen overflow-hidden p-0 lg:p-4">
      <div className="mx-auto grid h-full max-w-[1600px] grid-cols-1 overflow-hidden lg:grid-cols-[310px_minmax(0,1fr)]">
        <div className={`${contentOpen ? 'hidden lg:block' : 'block'} min-h-0`}>
          <Sidebar
            conversations={conversations}
            keyReady={keyStatus === 'ready'}
            onArchive={handleArchiveConversation}
            onDelete={handleDeleteConversation}
            onLogout={auth.logout}
            onNew={() => setShowNew(true)}
            onSelect={(id) => { setSelectedId(String(id)); setView('chat') }}
            onToggleArchived={() => setShowArchived((current) => !current)}
            onView={(nextView) => setView(nextView)}
            selectedId={selectedId}
            showArchived={showArchived}
            user={auth.session.user}
            view={view}
          />
        </div>

        <section className={`${contentOpen ? 'flex' : 'hidden lg:flex'} panel relative min-h-0 flex-col overflow-hidden rounded-none border-0 lg:rounded-r-3xl lg:border`}>
          <button className="absolute left-3 top-3 z-30 rounded-lg border border-line bg-panel px-3 py-2 text-xs text-slate-300 lg:hidden" onClick={() => { setSelectedId(null); setView('chat') }}>← Danh sách</button>
          {systemError && <div className="absolute left-1/2 top-3 z-40 flex w-[min(90%,680px)] -translate-x-1/2 items-start justify-between gap-3 rounded-xl border border-red-400/30 bg-[#351a24] px-4 py-3 text-xs text-red-100 shadow-2xl"><span>{systemError}</span><button onClick={() => setSystemError('')}>×</button></div>}
          {keyWarning && view === 'chat' && (
            <div className="border-b border-amber/25 bg-amber/10 px-5 py-3 text-center text-xs text-amber">
              {keyWarning}{' '}
              {keyStatus === 'missing'
                ? <button className="ml-2 font-bold underline" onClick={() => createDeviceIdentity()}>Tạo khóa cục bộ</button>
                : <button className="ml-2 font-bold underline" onClick={() => setView('profile')}>Mở Hồ sơ</button>}
            </div>
          )}
          <div className="min-h-0 flex-1">
            {view === 'chat' && <ChatWorkspace api={auth.api} conversation={selectedConversation} currentUser={auth.session.user} identity={identity} keyStatus={keyStatus} onConversationActivity={handleConversationActivity} onKeyMismatch={handleKeyMismatch} socket={socket} />}
            {view === 'profile' && <ProfilePanel api={auth.api} identity={identity} keyStatus={keyStatus} onCreateIdentity={createDeviceIdentity} onProfileChanged={updateSessionUser} onRestoreIdentity={restoreDeviceIdentity} onSynchronizeIdentity={synchronizeDeviceIdentity} userId={currentUserId} />}
            {view === 'forensics' && <ForensicsPanel api={auth.api} conversations={conversations} currentUser={auth.session.user} identity={identity} />}
          </div>
        </section>
      </div>

      {showNew && <NewConversationModal api={auth.api} onClose={() => setShowNew(false)} onCreated={handleConversationCreated} />}
    </main>
  )
}
