type ZipFile = { name: string; data: Uint8Array; mtime?: Date };

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

function encodeUtf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dateToDos(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = Math.floor(d.getSeconds() / 2);
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { time: dosTime & 0xffff, date: dosDate & 0xffff };
}

function sanitizeZipPath(name: string): string {
  const v = name.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = v.split("/").filter(Boolean);
  return parts
    .map((p) =>
      p
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || "file"
    )
    .join("/");
}

export function createZipStore(files: ZipFile[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const name = sanitizeZipPath(f.name);
    const nameBytes = encodeUtf8(name);
    const data = f.data ?? new Uint8Array();
    const crc = crc32(data);
    const mtime = f.mtime ?? new Date();
    const dos = dateToDos(mtime);

    const LOCAL_SIG = u32(0x04034b50);
    const CENTRAL_SIG = u32(0x02014b50);

    const versionNeeded = u16(20);
    const flags = u16(0x0800); // UTF-8
    const method = u16(0); // store
    const modTime = u16(dos.time);
    const modDate = u16(dos.date);
    const crcBytes = u32(crc);
    const compSize = u32(data.length);
    const uncompSize = u32(data.length);
    const nameLen = u16(nameBytes.length);
    const extraLen = u16(0);

    const localHeader = concat([
      LOCAL_SIG,
      versionNeeded,
      flags,
      method,
      modTime,
      modDate,
      crcBytes,
      compSize,
      uncompSize,
      nameLen,
      extraLen,
      nameBytes
    ]);
    localParts.push(localHeader, data);

    const versionMadeBy = u16(20);
    const disk = u16(0);
    const internalAttrs = u16(0);
    const externalAttrs = u32(0);
    const localOffset = u32(offset);
    const commentLen = u16(0);

    const centralHeader = concat([
      CENTRAL_SIG,
      versionMadeBy,
      versionNeeded,
      flags,
      method,
      modTime,
      modDate,
      crcBytes,
      compSize,
      uncompSize,
      nameLen,
      extraLen,
      commentLen,
      disk,
      internalAttrs,
      externalAttrs,
      localOffset,
      nameBytes
    ]);
    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralDir = concat(centralParts);
  const centralOffset = offset;
  const centralSize = centralDir.length;

  const END_SIG = u32(0x06054b50);
  const disk = u16(0);
  const diskStart = u16(0);
  const entriesThisDisk = u16(files.length);
  const entriesTotal = u16(files.length);
  const cdSize = u32(centralSize);
  const cdOffset = u32(centralOffset);
  const commentLen = u16(0);

  const end = concat([END_SIG, disk, diskStart, entriesThisDisk, entriesTotal, cdSize, cdOffset, commentLen]);
  return concat([...localParts, centralDir, end]);
}

