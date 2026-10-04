/** Transports: how a player talks to the host simulation (§2.2). */
import type { CtrlMessage } from './messages';

export interface Transport {
  /** Sends an encoded input message (§9.3) to the host. */
  sendInput(buf: ArrayBuffer): void;
  /** Sends a `ctrl` message to the host. */
  sendCtrl(msg: CtrlMessage): void;
  /** Called with each snapshot part from the host. */
  onSnapshot: (buf: ArrayBuffer) => void;
  /** Called with each `ctrl` message from the host. */
  onCtrl: (msg: CtrlMessage) => void;
  close(): void;
}

/**
 * The host's own player (and the singleplayer player): `postMessage` to the simulation worker.
 * The host session owns the worker and feeds this transport with what the worker sends to its player.
 */
export class LocalTransport implements Transport {
  onSnapshot: (buf: ArrayBuffer) => void = () => {};
  onCtrl: (msg: CtrlMessage) => void = () => {};

  constructor(
    private readonly playerId: number,
    private readonly worker: Worker,
  ) {}

  sendInput(buf: ArrayBuffer): void {
    this.worker.postMessage({ t: 'input', playerId: this.playerId, buf }, [buf]);
  }

  /** The same `ctrl` messages as a remote client's, without serialization (§9.2). */
  sendCtrl(msg: CtrlMessage): void {
    this.worker.postMessage({ t: 'ctrl', playerId: this.playerId, msg });
  }

  /** Delivers a snapshot part from the worker. */
  deliverSnapshot(buf: ArrayBuffer): void {
    this.onSnapshot(buf);
  }

  /** Delivers a `ctrl` message from the worker. */
  deliverCtrl(msg: CtrlMessage): void {
    this.onCtrl(msg);
  }

  close(): void {}
}
