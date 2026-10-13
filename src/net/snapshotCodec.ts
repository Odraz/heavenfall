/** Lossless transport compression leaves the bounded snapshot layout/assembler and 10 Hz rate intact. */
import { MAX_SNAPSHOT_BYTES, HEADER_BYTES, PLAYER_BYTES, DOMINION_CAST_BYTES, ENEMY_BYTES, PROJECTILE_BYTES, PICKUP_BYTES } from './protocol';
import { COMMANDER_BYTES } from './commanderCodec';
import { PROTOCOL_VERSION } from './version';
const MAX_SNAPSHOT_PARTS = 4;
const DEFLATE = 0xfe;
const PREFIX = 4;
const MIN_COMPRESS_BYTES = 1024;

export async function packSnapshot(raw: ArrayBuffer): Promise<ArrayBuffer> {
  if (raw.byteLength < MIN_COMPRESS_BYTES || raw.byteLength > MAX_SNAPSHOT_BYTES || typeof CompressionStream === 'undefined') return raw;
  try {
    const planes = transpose(raw, false);
    const stream = new Blob([planes ?? raw]).stream().pipeThrough(new CompressionStream('deflate'));
    const bytes = await readBounded(stream, raw.byteLength - PREFIX - 1);
    if (!bytes) return raw;
    const out = new Uint8Array(PREFIX + bytes.length); out[0] = DEFLATE;
    new DataView(out.buffer).setUint16(1, raw.byteLength, true); out[3] = planes ? 1 : 0; out.set(bytes, PREFIX); return out.buffer;
  } catch { return raw; }
}

export async function unpackSnapshot(wire: ArrayBuffer): Promise<ArrayBuffer | null> {
  if (!wire.byteLength || wire.byteLength > MAX_SNAPSHOT_BYTES) return null;
  const data = new Uint8Array(wire); if (data[0] !== DEFLATE) return wire;
  if (data.length <= PREFIX || data[3] > 1 || typeof DecompressionStream === 'undefined') return null;
  const size = new DataView(wire).getUint16(1, true);
  if (size < MIN_COMPRESS_BYTES || size > MAX_SNAPSHOT_BYTES || wire.byteLength >= size) return null;
  try {
    const bytes = await readBounded(new Blob([data.subarray(PREFIX)]).stream().pipeThrough(new DecompressionStream('deflate')), size);
    if (bytes?.length !== size) return null;
    return data[3] === 1 ? transpose(bytes.buffer as ArrayBuffer, true) : bytes.buffer as ArrayBuffer;
  } catch { return null; }
}

/** Group each bounded record's corresponding bytes before deflate; every input byte is restored. */
function transpose(raw: ArrayBuffer, reverse: boolean): ArrayBuffer | null {
  if (raw.byteLength < HEADER_BYTES || raw.byteLength > MAX_SNAPSHOT_BYTES) return null;
  const v = new DataView(raw); if (v.getUint8(0) !== PROTOCOL_VERSION) return null;
  const counts = [v.getUint8(3), v.getUint8(66), v.getUint8(68), v.getUint16(55, true), v.getUint16(57, true), v.getUint16(59, true)];
  if (counts.some((n, i) => n > [4, 3, 3, 1500, 400, 160][i])) return null;
  const sizes = [PLAYER_BYTES, DOMINION_CAST_BYTES, COMMANDER_BYTES, ENEMY_BYTES, PROJECTILE_BYTES, PICKUP_BYTES];
  if (HEADER_BYTES + counts.reduce((n, c, i) => n + c * sizes[i], 0) !== raw.byteLength) return null;
  const input = new Uint8Array(raw), output = new Uint8Array(raw.byteLength); output.set(input.subarray(0, HEADER_BYTES));
  let offset = HEADER_BYTES;
  for (let i = 0; i < counts.length; i++) {
    const count = counts[i], size = sizes[i];
    for (let column = 0; column < size; column++) for (let row = 0; row < count; row++) {
      const a = offset + row * size + column, b = offset + column * count + row;
      if (reverse) output[a] = input[b]; else output[b] = input[a];
    }
    offset += count * size;
  }
  return output.buffer;
}

async function readBounded(stream: ReadableStream<Uint8Array>, limit: number): Promise<Uint8Array | null> {
  const reader = stream.getReader(), out = new Uint8Array(limit); let offset = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) return out.slice(0, offset);
      if (offset + value.length > limit) { await reader.cancel(); return null; }
      out.set(value, offset); offset += value.length;
    }
  } finally { reader.releaseLock(); }
}

/** At most one encoding tick plus its newest successor; obsolete complete groups are coalesced. */
export class SnapshotSender {
  private pending: readonly ArrayBuffer[] | null = null;
  private running = false;
  private closed = false;
  constructor(private readonly send: (parts: readonly ArrayBuffer[]) => void, private readonly encode = packSnapshot) {}
  offer(parts: readonly ArrayBuffer[]): void {
    if (this.closed || !parts.length || parts.length > MAX_SNAPSHOT_PARTS || parts.some((p) => p.byteLength > MAX_SNAPSHOT_BYTES)) return;
    this.pending = parts; if (!this.running) void this.drain();
  }
  close(): void { this.closed = true; this.pending = null; }
  private async drain(): Promise<void> {
    this.running = true;
    try {
      while (this.pending && !this.closed) {
        const parts = this.pending; this.pending = null;
        const packed: ArrayBuffer[] = [];
        for (const raw of parts) packed.push(await this.encode(raw).catch(() => raw));
        if (!this.closed) this.send(packed);
      }
    } finally { this.running = false; }
  }
}

/** One decoding job and <= four waiting parts; overload drops parts without partial publication. */
export class SnapshotReceiver {
  private readonly pending: ArrayBuffer[] = [];
  private running = false;
  private closed = false;
  constructor(private readonly receive: (raw: ArrayBuffer) => void, private readonly decode = unpackSnapshot) {}
  offer(wire: ArrayBuffer): void {
    if (this.closed || !wire.byteLength || wire.byteLength > MAX_SNAPSHOT_BYTES) return;
    if (this.pending.length >= MAX_SNAPSHOT_PARTS) this.pending.shift();
    this.pending.push(wire); if (!this.running) void this.drain();
  }
  close(): void { this.closed = true; this.pending.length = 0; }
  private async drain(): Promise<void> {
    this.running = true;
    try {
      while (this.pending.length && !this.closed) {
        const raw = await this.decode(this.pending.shift()!).catch(() => null);
        if (!this.closed && raw) this.receive(raw);
      }
    } finally { this.running = false; }
  }
}
