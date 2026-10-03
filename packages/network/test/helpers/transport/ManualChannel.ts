// Import Internal Dependencies
import type { ChannelPort } from "#src/transport/channel.ts";

type PortListener = (event: { data: unknown; }) => void;

export class ManualPort implements ChannelPort {
  readonly inbox: unknown[] = [];
  readonly posted: unknown[] = [];
  readonly listeners = new Set<PortListener>();
  peer: ManualPort | null = null;
  started = false;
  closed = false;

  get deliverable(): boolean {
    return this.started && !this.closed && this.inbox.length > 0;
  }

  postMessage(
    message: unknown
  ): void {
    if (this.closed) {
      return;
    }

    this.posted.push(message);
    this.peer?.inbox.push(structuredClone(message));
  }

  addEventListener(
    _type: "message",
    listener: PortListener
  ): void {
    this.listeners.add(listener);
  }

  removeEventListener(
    _type: "message",
    listener: PortListener
  ): void {
    this.listeners.delete(listener);
  }

  start(): void {
    this.started = true;
  }

  close(): void {
    this.closed = true;
    this.inbox.length = 0;
  }

  inject(
    message: unknown
  ): void {
    if (!this.closed) {
      this.inbox.push(message);
    }
  }

  deliverNext(): void {
    const data = this.inbox.shift();
    for (const listener of [...this.listeners]) {
      listener({ data });
    }
  }
}

export class ManualChannel {
  readonly port1 = new ManualPort();
  readonly port2 = new ManualPort();

  constructor() {
    this.port1.peer = this.port2;
    this.port2.peer = this.port1;
  }

  get ports(): ManualPort[] {
    return [this.port1, this.port2];
  }
}
