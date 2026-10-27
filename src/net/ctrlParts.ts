/**
 * `ctrl` messages too large for PeerJS's JSON channel (R9 review N1). PeerJS refuses a JSON message of
 * CTRL_JSON_LIMIT bytes or more with a `message-too-big` error and sends nothing, so a large message
 * (a late joiner's `floorSync`, a `hello` carrying a big profile) would be lost without a trace. Such a
 * message goes out as ordered `part` messages, each under the limit, that the receiver joins back.
 * The channel is reliable and ordered, and a sender sends all of a message's parts at once, so the
 * parts of one message arrive together and in order; anything else is refused.
 */
import type { CtrlMessage } from './messages';
import { jsonBytes } from './netStats';

/** PeerJS's `chunkedMTU`: a JSON message this large or larger is refused. */
export const CTRL_JSON_LIMIT = 16300;
/** Characters of the message's JSON per part, before the part is checked against the limit. */
const PART_CHARS = 8000;
/** At most this many parts, and this many characters, in one joined message. */
export const MAX_PARTS = 64;
export const MAX_JOINED_CHARS = 512 * 1024;

type Part = Extract<CtrlMessage, { type: 'part' }>;

/** The text cut into parts that each encode under the limit; a part too large (escapes, non-ASCII) is halved. */
function cut(text: string, size: number, id: number, out: string[]): void {
  for (let at = 0; at < text.length; at += size) {
    const data = text.slice(at, at + size);
    if (size > 1 && jsonBytes({ type: 'part', id, i: MAX_PARTS, n: MAX_PARTS, data }) >= CTRL_JSON_LIMIT) cut(data, Math.ceil(size / 2), id, out);
    else out.push(data);
  }
}

/**
 * What to send for `msg`: the message itself when it fits, else its parts. `bytes` is its JSON size
 * when the caller has it. A message too large even in parts is nothing, with a warning.
 */
export function ctrlParts(msg: CtrlMessage, id: number, bytes = jsonBytes(msg)): CtrlMessage[] {
  if (bytes < CTRL_JSON_LIMIT) return [msg];
  const text = JSON.stringify(msg), data: string[] = [];
  if (text.length <= MAX_JOINED_CHARS) cut(text, PART_CHARS, id, data);
  if (!data.length || data.length > MAX_PARTS) {
    console.warn(`diagnostic: ctrl message ${msg.type} too large to send (${bytes} bytes)`);
    return [];
  }
  return data.map((d, i): Part => ({ type: 'part', id, i, n: data.length, data: d }));
}

/** Joins one connection's parts back into messages. */
export class CtrlJoiner {
  private id = -1;
  private next = 0;
  private n = 0;
  private chars = 0;
  private readonly data: string[] = [];

  /**
   * A received `part`: the joined message when it was the last, else null. A part out of order, of a
   * different message before the current one finished, or past the bounds drops the message.
   */
  add(part: Part): CtrlMessage | null {
    const { id, i, n, data } = part;
    if (!Number.isInteger(id) || !Number.isInteger(i) || !Number.isInteger(n) || n < 2 || n > MAX_PARTS || i < 0 || i >= n || typeof data !== 'string') return this.reset();
    if (i === 0) { this.reset(); this.id = id; this.n = n; }
    else if (id !== this.id || i !== this.next || n !== this.n) return this.reset();
    this.chars += data.length;
    if (this.chars > MAX_JOINED_CHARS) return this.reset();
    this.data.push(data);
    this.next = i + 1;
    if (this.next < n) return null;
    const text = this.data.join('');
    this.reset();
    try {
      const msg: unknown = JSON.parse(text);
      return typeof msg === 'object' && msg !== null && typeof (msg as { type?: unknown }).type === 'string' && (msg as { type: string }).type !== 'part' ? msg as CtrlMessage : null;
    } catch {
      return null;
    }
  }

  private reset(): null {
    this.id = -1; this.next = 0; this.n = 0; this.chars = 0; this.data.length = 0;
    return null;
  }
}
