export type CachedState<T> = { state: T; base?: T }
let database: Promise<IDBDatabase> | undefined

function openDatabase() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('goy-suite-cache-v1', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('accounts')
    request.onerror = () => { database = undefined; reject(request.error) }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => { db.close(); database = undefined }
      resolve(db)
    }
  })
  return database
}

export function createLocalCache<T>(appId: string, normalize: (value: unknown) => T) {
  const keyFor = (owner: string | null) => `${appId}:${owner ?? 'guest'}`
  return {
    async read(owner: string | null): Promise<CachedState<T> | undefined> {
      const key = keyFor(owner)
      let value: CachedState<unknown> | undefined
      if ('indexedDB' in globalThis) {
        const db = await openDatabase()
        value = await new Promise((resolve, reject) => {
          const request = db.transaction('accounts').objectStore('accounts').get(key)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
      } else {
        const raw = localStorage.getItem(key)
        value = raw ? JSON.parse(raw) : undefined
      }
      return value ? { state: normalize(value.state), base: value.base ? normalize(value.base) : undefined } : undefined
    },
    async write(owner: string | null, value: CachedState<T>): Promise<void> {
      const key = keyFor(owner)
      if (!('indexedDB' in globalThis)) {
        localStorage.setItem(key, JSON.stringify(value))
        return
      }
      const db = await openDatabase()
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('accounts', 'readwrite')
        transaction.objectStore('accounts').put(value, key)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      })
    },
  }
}
