export function isPublishableKey(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (value.startsWith('sb_publishable_')) return value.length > 20
  try {
    const payload = value.split('.')[1]
    if (!payload) return false
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon'
  } catch {
    return false
  }
}
