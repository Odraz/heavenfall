/** Reliable R1 events have one payload per revision; snapshots do not advance this watermark. */
import type { CtrlMessage } from './messages';

export class RunEvents {
  private revision = -1;

  constructor(readonly runId: string) {}

  accept(msg: Extract<CtrlMessage, { type: 'event' }>): boolean {
    if (msg.runId !== this.runId || !Number.isInteger(msg.tick) || msg.tick < 0 || msg.tick > 0xffffffff ||
      !Number.isInteger(msg.revision) || msg.revision < 0 || msg.revision > 0xffffffff || msg.revision <= this.revision) return false;
    this.revision = msg.revision;
    return true;
  }
}
