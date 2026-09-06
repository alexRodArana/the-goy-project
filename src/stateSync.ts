type Entity = Record<string, unknown>
export type CollectionChange = { upsert: unknown[]; remove: string[] }
export type StatePatch = { patch: Record<string, unknown>; changes: Record<string, CollectionChange> }

const collections = new Set(['routines', 'workouts', 'meals', 'sessions', 'creatineDates'])
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b)

export const entityKey = (collection: string, item: unknown): string => {
  if (collection === 'creatineDates') return String(item)
  const value = item as Entity
  return collection === 'sessions' ? `${value.date}::${value.mealId}` : String(value.id)
}

export function buildStatePatch<T extends object>(state: T, previous?: T): StatePatch {
  const patch: StatePatch['patch'] = {}
  const changes: StatePatch['changes'] = {}
  for (const [key, value] of Object.entries(state)) {
    const before = previous?.[key as keyof T]
    if (same(value, before)) continue
    if (collections.has(key) && Array.isArray(value)) {
      const old = new Map((Array.isArray(before) ? before : []).map((item) => [entityKey(key, item), item]))
      const nextKeys = new Set(value.map((item) => entityKey(key, item)))
      const change = {
        upsert: value.filter((item) => !same(item, old.get(entityKey(key, item)))),
        remove: [...old.keys()].filter((id) => !nextKeys.has(id)),
      }
      if (change.upsert.length || change.remove.length) changes[key] = change
    } else {
      patch[key] = value ?? null
    }
  }
  return { patch, changes }
}

export const hasStateChanges = (value: StatePatch) => Boolean(Object.keys(value.patch).length || Object.keys(value.changes).length)

// Replay only local edits on top of the latest server snapshot after reconnecting.
export function mergePendingState<T extends object>(remote: T, local: T, base: T): T {
  const { patch, changes } = buildStatePatch(local, base)
  const result: Record<string, unknown> = { ...remote, ...patch }
  for (const [key, change] of Object.entries(changes)) {
    const removed = new Set(change.remove)
    const updated = new Map(change.upsert.map((item) => [entityKey(key, item), item]))
    const values: unknown[] = []
    for (const item of (result[key] as unknown[] | undefined) ?? []) {
      const id = entityKey(key, item)
      if (!removed.has(id)) values.push(updated.has(id) ? updated.get(id) : item)
      updated.delete(id)
    }
    values.push(...updated.values())
    result[key] = values
  }
  return result as T
}
