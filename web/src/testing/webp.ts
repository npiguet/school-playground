// A WebP's pixel size from its header (VP8X, VP8L or VP8), without a dependency (moved out of
// art.test.ts: the room's places test, treasures.test.ts, reads the treasures' aspect from their
// files too). Reads only the first 32 bytes: the accessory test calls it 192 times on pictures up
// to 300 KB, and reading them whole through the npm container's bind mount passed vitest's 5 s
// timeout on a cold cache.
import { closeSync, openSync, readSync } from 'node:fs';

export function webpSize(file: string): { w: number; h: number } {
  const b = Buffer.alloc(32);
  const fd = openSync(file, 'r');
  try {
    readSync(fd, b, 0, 32, 0);
  } finally {
    closeSync(fd);
  }
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (chunk === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  throw new Error(`${file}: not a WebP`);
}
