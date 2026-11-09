// Slides store media as "media/<file>". Electron windows load it through the nlmedia:// protocol,
// browsers on the network through the LAN server (/media/<file>). Full URLs pass through.
const inElectron = typeof window !== 'undefined' && typeof window.nl !== 'undefined'

export function mediaUrl(ref: string): string {
  if (/^(https?:|data:|blob:|nlmedia:)/.test(ref)) return ref
  const clean = ref.replace(/^\/+/, '')
  return inElectron ? `nlmedia://${clean}` : `/${clean}`
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}
