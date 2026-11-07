// Import Internal Dependencies
import { contentHash } from "../common/contentHash.ts";
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
  #byRoom = new Map<string, HeldContent>();
  #byTicket = new Map<string, HeldContent>();

  async issue(
    roomId: string,
    bytes: Uint8Array,
    options: ContentRefOptions = {}
  ): Promise<ContentRef> {
    this.#issuing.set(roomId, bytes);
    const hash = await contentHash(bytes);
    if (this.#issuing.get(roomId) !== bytes) {
      throw new Error(`Room ${roomId} moved on before its content ref was issued.`);
    }

    this.#drop(roomId);
    const held: HeldContent = {
      hash,
      bytes,
      ticket: crypto.randomUUID(),
      compress: options.compress === true
    };
    this.#byRoom.set(roomId, held);
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
    const held = this.#byRoom.get(roomId);
    if (held !== undefined) {
      this.#byRoom.delete(roomId);
      this.#byTicket.delete(held.ticket);
    }
  }
}
