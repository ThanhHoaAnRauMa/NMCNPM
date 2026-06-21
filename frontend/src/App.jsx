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
import { loadIdentity, saveIdentity } from './lib/keyStore.js'

export default function App() {
  const auth = useSession()
  const [identity, setIdentity] = useState(null)
  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [view, setView] = useState('chat')
  const [showNew, setShowNew] = useState(false)
  const [socket, setSocket] = useState(null)
  const [systemError, setSystemError] = useState('')
  const currentUserId = auth.session?.user?.id || auth.session?.user?._id

  const refreshConversations = useCallback(async (preferredId) => {
    if (!auth.session) return
    try {
      const payload = await auth.api.get('/chat/conversations')
      setConversations(payload.conversations)
      if (preferredId) setSelectedId(String(preferredId))
      else if (!selectedId && payload.conversations.length) setSelectedId(String(payload.conversations[0]._id))
    } catch (error) {
      setSystemError(error.message)
    }
  }, [auth.api, auth.session, selectedId])

  useEffect(() => {
    if (!currentUserId) {
      setIdentity(null)
      return
    }
    loadIdentity(currentUserId).then(setIdentity).catch(() => setSystemError('Không truy cập được kho khóa IndexedDB.'))
  }, [currentUserId])

  useEffect(() => {
    if (!auth.session?.accessToken) return
    const connection = io(API_URL, {
      auth: { token: auth.session.accessToken },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 8,
    })
    connection.on('connect_error', (error) => setSystemError(`Realtime: ${error.message}`))
    connection.on('connect', () => setSystemError(''))
    setSocket(connection)
    return () => {
      connection.disconnect()
      setSocket(null)
    }
  }, [auth.session?.accessToken])

  useEffect(() => {
    if (auth.session) refreshConversations()
  // Initial session load only; explicit mutations call refreshConversations.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(auth.session)])

  const selectedConversation = useMemo(() => conversations.find((conversation) => String(conversation._id) === String(selectedId)) || null, [conversations, selectedId])

  const createDeviceIdentity = async () => {
    setSystemError('')
    try {
      const generated = await generateIdentity()
      await auth.api.post('/users/pubkey', { publicKey: generated.publicBundle })
      await saveIdentity(currentUserId, generated)
      setIdentity({ userId: currentUserId, ...generated })
      await refreshConversations(selectedId)
    } catch (error) {
      setSystemError(`Không tạo được khóa thiết bị: ${error.message}`)
    }
  }

  const restoreDeviceIdentity = async (restored) => {
    await auth.api.post('/users/pubkey', { publicKey: restored.publicBundle })
    await saveIdentity(currentUserId, restored)
    setIdentity({ userId: currentUserId, ...restored })
    await refreshConversations(selectedId)
  }

  const updateSessionUser = (user) => {
    auth.setSession({ ...auth.session, user: { ...auth.session.user, ...user, id: user.id || user._id } })
  }

  if (!auth.session) return <AuthScreen authenticate={auth.authenticate} />

  const contentOpen = view !== 'chat' || Boolean(selectedId)

  return (
    <main className="h-screen overflow-hidden p-0 lg:p-4">
      <div className="mx-auto grid h-full max-w-[1600px] grid-cols-1 overflow-hidden lg:grid-cols-[310px_minmax(0,1fr)]">
        <div className={`${contentOpen ? 'hidden lg:block' : 'block'} min-h-0`}>
          <Sidebar
            conversations={conversations}
            keyReady={Boolean(identity)}
            onLogout={auth.logout}
            onNew={() => setShowNew(true)}
            onSelect={(id) => { setSelectedId(String(id)); setView('chat') }}
            onView={(nextView) => setView(nextView)}
            selectedId={selectedId}
            user={auth.session.user}
            view={view}
          />
        </div>

        <section className={`${contentOpen ? 'flex' : 'hidden lg:flex'} panel relative min-h-0 flex-col overflow-hidden rounded-none border-0 lg:rounded-r-3xl lg:border`}>
          <button className="absolute left-3 top-3 z-30 rounded-lg border border-line bg-panel px-3 py-2 text-xs text-slate-300 lg:hidden" onClick={() => { setSelectedId(null); setView('chat') }}>← Danh sách</button>
          {systemError && <div className="absolute left-1/2 top-3 z-40 flex w-[min(90%,680px)] -translate-x-1/2 items-start justify-between gap-3 rounded-xl border border-red-400/30 bg-[#351a24] px-4 py-3 text-xs text-red-100 shadow-2xl"><span>{systemError}</span><button onClick={() => setSystemError('')}>×</button></div>}
          {!identity && view === 'chat' && (
            <div className="border-b border-amber/25 bg-amber/10 px-5 py-3 text-center text-xs text-amber">
              Thiết bị chưa có khóa riêng. <button className="ml-2 font-bold underline" onClick={createDeviceIdentity}>Tạo khóa cục bộ</button>
            </div>
          )}
          <div className="min-h-0 flex-1">
            {view === 'chat' && <ChatWorkspace api={auth.api} conversation={selectedConversation} currentUser={auth.session.user} identity={identity} socket={socket} />}
            {view === 'profile' && <ProfilePanel api={auth.api} identity={identity} onCreateIdentity={createDeviceIdentity} onProfileChanged={updateSessionUser} onRestoreIdentity={restoreDeviceIdentity} userId={currentUserId} />}
            {view === 'forensics' && <ForensicsPanel api={auth.api} conversations={conversations} currentUser={auth.session.user} identity={identity} />}
          </div>
        </section>
      </div>

      {showNew && <NewConversationModal api={auth.api} onClose={() => setShowNew(false)} onCreated={async (id) => { await refreshConversations(id); setView('chat') }} />}
    </main>
  )
}
