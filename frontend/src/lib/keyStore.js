const DATABASE_NAME = 'secure-chat-forensics'
const STORE_NAME = 'device-identities'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'userId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transaction(mode, operation) {
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, mode)
      const request = operation(tx.objectStore(STORE_NAME))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    database.close()
  }
}

export function loadIdentity(userId) {
  return transaction('readonly', (store) => store.get(userId))
}

export function saveIdentity(userId, identity) {
  return transaction('readwrite', (store) => store.put({ userId, ...identity }))
}

export function removeIdentity(userId) {
  return transaction('readwrite', (store) => store.delete(userId))
}
