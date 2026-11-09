// Minimal ZIP reader (stored + deflate, no ZIP64), enough to read the XML parts of a .pptx.
import { inflateRawSync } from 'node:zlib'

export interface ZipEntry {
  name: string
  read: () => Buffer
}

export function readZip(buf: Buffer): Map<string, ZipEntry> {
  // End of central directory: 22 bytes + up to 64 KB comment, at the end of the file.
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a zip file')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const entries = new Map<string, ZipEntry>()
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error('damaged zip file')
    const method = buf.readUInt16LE(p + 10)
    const csize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8')
    p += 46 + nameLen + extraLen + commentLen
    entries.set(name, {
      name,
      read: () => {
        if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('damaged zip file')
        const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
        const data = buf.subarray(start, start + csize)
        if (method === 0) return Buffer.from(data)
        if (method === 8) return inflateRawSync(data, { maxOutputLength: 64 * 1024 * 1024 })
        throw new Error(`unsupported zip compression ${method}`)
      }
    })
  }
  return entries
}
