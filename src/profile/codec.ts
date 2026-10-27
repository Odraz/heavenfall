import { MAX_SAVE_BYTES, parseProfile, validateProfile, type Profile } from './model';

export const MAX_CODE_BYTES = 64 * 1024;
export function crc32(text: string): string {
  let crc = 0xffffffff;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i);
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
}
/** Standards-compliant raw-DEFLATE stored blocks: portable export when compression is absent. */
function storedDeflate(bytes: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(bytes.length / 65535)), result = new Uint8Array(bytes.length + blocks * 5);
  let at = 0;
  for (let b = 0; b < blocks; b++) {
    const chunk = bytes.subarray(b * 65535, (b + 1) * 65535), n = chunk.length;
    result.set([b === blocks - 1 ? 1 : 0, n & 255, n >>> 8, (~n) & 255, ((~n) >>> 8) & 255], at);
    result.set(chunk, at + 5); at += n + 5;
  }
  return result;
}
/** Fallback only accepts stored blocks. Unsupported compressed imports fail without a write. */
function storedInflate(bytes: Uint8Array): Uint8Array {
  let at = 0, size = 0; const chunks: Uint8Array[] = [];
  while (at < bytes.length) {
    const header = bytes[at++];
    if (header !== 0 && header !== 1) throw new Error('Raw-DEFLATE decompression is unavailable in this browser; import with a supported browser');
    if (at + 4 > bytes.length) throw new Error('Truncated save');
    const length = bytes[at] | bytes[at + 1] << 8, inverse = bytes[at + 2] | bytes[at + 3] << 8; at += 4;
    if ((length ^ inverse) !== 65535 || at + length > bytes.length) throw new Error('Invalid save compression');
    size += length; if (size > MAX_SAVE_BYTES) throw new Error('Save exceeds 256 KiB');
    chunks.push(bytes.subarray(at, at + length)); at += length;
    if (header === 1) {
      if (at !== bytes.length) throw new Error('Trailing save data');
      const result = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
      return result;
    }
  }
  throw new Error('Truncated save');
}
async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, limit: number): Promise<Uint8Array> {
  const reader = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream).getReader();
  let size = 0; const parts: Uint8Array[] = [];
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.length;
      if (size > limit) { await reader.cancel(); throw new Error(`Save exceeds ${limit / 1024} KiB`); }
      parts.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size); let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
export async function exportCode(profile: Profile, portable = false): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(validateProfile(profile).profile));
  if (bytes.length > MAX_SAVE_BYTES) throw new Error('Save exceeds 256 KiB');
  let stream: CompressionStream | null = null;
  if (!portable) { try { stream = new CompressionStream('deflate-raw'); } catch { /* Stored-block export is always supported. */ } }
  const compressed = stream ? await transform(bytes, stream, MAX_CODE_BYTES) : storedDeflate(bytes);
  let binary = ''; for (const byte of compressed) binary += String.fromCharCode(byte);
  const part = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const code = `MG1.${part}.${crc32(part)}`;
  if (code.length > MAX_CODE_BYTES) throw new Error('Export exceeds 64 KiB');
  return code;
}
export async function importCode(input: string, portable = false): Promise<Profile> {
  if (input.length > MAX_CODE_BYTES || new TextEncoder().encode(input).length > MAX_CODE_BYTES) throw new Error('Save code exceeds 64 KiB');
  const match = /^MG1\.([A-Za-z0-9_-]+)\.([a-f0-9]{8})$/.exec(input.trim());
  if (!match || crc32(match[1]) !== match[2]) throw new Error('Invalid save code or checksum');
  const binary = atob(match[1].replace(/-/g, '+').replace(/_/g, '/'));
  // Reject noncanonical encodings (including nonzero padding bits).
  if (btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== match[1]) throw new Error('Invalid save encoding');
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  let stream: DecompressionStream | null = null;
  if (!portable) { try { stream = new DecompressionStream('deflate-raw'); } catch { /* Narrow, bounded compatibility fallback below. */ } }
  const expanded = stream ? await transform(bytes, stream, MAX_SAVE_BYTES) : storedInflate(bytes);
  return parseProfile(new TextDecoder('utf-8', { fatal: true }).decode(expanded)).profile;
}
export function exportFilename(profile: Profile): string {
  return `meatgrinder-${profile.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 16)}.txt`;
}
