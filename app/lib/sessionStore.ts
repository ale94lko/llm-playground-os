/** Safe sessionStorage adapter for Pinia persist (SSR-compatible) */
export const sessionStore: Storage = {
  get length() {
    return import.meta.client ? sessionStorage.length : 0
  },
  clear() {
    if (import.meta.client) sessionStorage.clear()
  },
  getItem(key: string) {
    return import.meta.client ? sessionStorage.getItem(key) : null
  },
  key(index: number) {
    return import.meta.client ? sessionStorage.key(index) : null
  },
  removeItem(key: string) {
    if (import.meta.client) sessionStorage.removeItem(key)
  },
  setItem(key: string, value: string) {
    if (import.meta.client) sessionStorage.setItem(key, value)
  },
}
