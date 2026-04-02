/** Minimal ZIP (STORE – no compression) creator. No external dependencies. */

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc & 1) ? ((crc >>> 1) ^ 0xEDB88320) : (crc >>> 1)
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function u16(n: number): Uint8Array {
  return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF])
}

function u32(n: number): Uint8Array {
  return new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF])
}

function concat(arrays: Uint8Array[]): Uint8Array {
  let total = 0
  for (const a of arrays) total += a.length
  const out = new Uint8Array(total)
  let pos = 0
  for (const a of arrays) { out.set(a, pos); pos += a.length }
  return out
}

export interface ZipEntry { name: string; data: Uint8Array }

export function createZip(files: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder()
  const localParts: Uint8Array[] = []
  const cdParts: Uint8Array[] = []
  const offsets: number[] = []
  let offset = 0
  const zero2 = u16(0)
  const zero4 = u32(0)

  for (const file of files) {
    const name = enc.encode(file.name)
    const size = file.data.length
    const crc = crc32(file.data)
    offsets.push(offset)

    // Local file header (30 bytes + name)
    const lh = concat([
      new Uint8Array([0x50, 0x4B, 0x03, 0x04]), // PK\x03\x04
      u16(20), zero2,      // version needed, flags
      zero2, zero2, zero2, // compression=STORE, mod-time, mod-date
      u32(crc), u32(size), u32(size),
      u16(name.length), zero2, // filename len, extra len
      name,
    ])
    localParts.push(lh, file.data)
    offset += lh.length + size

    // Central directory record (46 bytes + name)
    cdParts.push(concat([
      new Uint8Array([0x50, 0x4B, 0x01, 0x02]), // PK\x01\x02
      u16(20), u16(20), zero2, // versions
      zero2, zero2, zero2,     // compression=STORE, mod-time, mod-date
      u32(crc), u32(size), u32(size),
      u16(name.length), zero2, zero2, // filename len, extra len, comment len
      zero2, zero2,            // disk start, internal attrs
      zero4,                   // external attrs
      u32(offsets[offsets.length - 1]),
      name,
    ]))
  }

  const cdOffset = offset
  let cdSize = 0
  for (const cd of cdParts) cdSize += cd.length

  // End of central directory (22 bytes)
  const eocd = concat([
    new Uint8Array([0x50, 0x4B, 0x05, 0x06]),
    zero2, zero2,
    u16(files.length), u16(files.length),
    u32(cdSize), u32(cdOffset),
    zero2, // comment length
  ])

  return concat([...localParts, ...cdParts, eocd])
}

/** Decode a data-URL or fetch a remote URL → Uint8Array */
export async function urlToBytes(url: string): Promise<Uint8Array> {
  if (url.startsWith('data:')) {
    const b64 = url.split(',')[1] ?? ''
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }
  const resp = await fetch(url)
  return new Uint8Array(await resp.arrayBuffer())
}
