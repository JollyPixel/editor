// Import Third-party Dependencies
import { sha256Hex } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type {
  ContentRef,
  ContentRefOptions
} from "../model/kinds/ContentRef.ts";

export interface ServedContent {
  readonly bytes: Uint8Array;
  readonly compress: boolean;
}

interface HeldContent extends ServedContent {
  readonly hash: string;
  readonly ticket: string;
}

export class ContentRefs {
  #issuing = new Map<string, Uint8Array>();
  #byRoom = new Map<string, readonly [HeldContent, HeldContent?]>();
  #byTicket = new Map<string, HeldContent>();

  async issue(
    roomId: string,
    bytes: Uint8Array,
    options: ContentRefOptions = {}
  ): Promise<ContentRef> {
    this.#issuing.set(roomId, bytes);
    const hash = await sha256Hex(bytes);
    if (this.#issuing.get(roomId) !== bytes) {
      throw new Error(`Room ${roomId} moved on before its content ref was issued.`);
    }

    const [previous, stale] = this.#byRoom.get(roomId) ?? [];
    if (stale !== undefined) {
      this.#byTicket.delete(stale.ticket);
    }
    const held: HeldContent = {
      hash,
      bytes,
      ticket: crypto.randomUUID(),
      compress: options.compress === true
    };
    this.#byRoom.set(roomId, [held, previous]);
    this.#byTicket.set(held.ticket, held);

    return {
      type: "ref",
      hash,
      size: bytes.byteLength,
      ticket: held.ticket
    };
  }

  release(
    roomId: string
  ): void {
    this.#issuing.delete(roomId);
    this.#drop(roomId);
  }

  read(
    hash: string,
    ticket: string
  ): ServedContent | null {
    const held = this.#byTicket.get(ticket);

    return held?.hash === hash ? held : null;
  }

  #drop(
    roomId: string
  ): void {
    for (const held of this.#byRoom.get(roomId) ?? []) {
      if (held !== undefined) {
        this.#byTicket.delete(held.ticket);
      }
    }
    this.#byRoom.delete(roomId);
  }
}
