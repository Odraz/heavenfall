/** Payload bytes received and sent over PeerJS, for `netInKBps` and `netOutKBps` (§2.5). */

const WINDOW_MS = 1000;
const encoder = new TextEncoder();

class Window {
  private readonly at: number[] = [];
  private readonly bytes: number[] = [];
  private sum = 0;

  add(n: number, now: number): void {
    this.at.push(now);
    this.bytes.push(n);
    this.sum += n;
  }

  /** KB (1 000 bytes) in the last 1 s. */
  kb(now: number): number {
    while (this.at.length && this.at[0] < now - WINDOW_MS) {
      this.at.shift();
      this.sum -= this.bytes.shift()!;
    }
    return this.sum / 1000;
  }
}

export class NetStats {
  private readonly inW = new Window();
  private readonly outW = new Window();

  received(n: number, now = performance.now()): void {
    this.inW.add(n, now);
  }

  sent(n: number, now = performance.now()): void {
    this.outW.add(n, now);
  }

  inKBps(now = performance.now()): number {
    return this.inW.kb(now);
  }

  outKBps(now = performance.now()): number {
    return this.outW.kb(now);
  }
}

/** The payload size of a JSON `ctrl` message, as PeerJS's JSON serialization sends it. */
export function jsonBytes(msg: unknown): number {
  return encoder.encode(JSON.stringify(msg)).byteLength;
}
