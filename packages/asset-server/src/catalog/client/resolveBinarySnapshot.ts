// Import Third-party Dependencies
import type {
  Room,
  RoomRejectionEvent
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  CONTENT_TICKET_HEADER,
  contentRefSchema,
  contentRefUrl,
  type ContentRef
} from "../../model/kinds/ContentRef.ts";
import {
  ASSET_ROOM_INLINE_SNAPSHOT,
  type AssetRoomInlineSnapshotMessage
} from "../../model/kinds/AssetLiveProtocol.ts";
import { ContentUnavailableError } from "./errors/ContentUnavailableError.ts";

// CONSTANTS
const kInlineSnapshotTimeoutMs = 30_000;

export function resolveBinarySnapshot(
  received: unknown,
  room: Room
): Uint8Array | Promise<Uint8Array> {
  if (received instanceof Uint8Array) {
    return received;
  }

  const ref = contentRefSchema.safeParse(received);
  if (!ref.success) {
    throw new TypeError("binary snapshot is neither bytes nor a content ref");
  }

  return fetchContent(ref.data).catch(
    (error: unknown) => inlineSnapshot(ref.data, room, error)
  );
}

async function fetchContent(
  ref: ContentRef
): Promise<Uint8Array> {
  const response = await fetch(contentRefUrl(ref.hash), {
    headers: {
      [CONTENT_TICKET_HEADER]: ref.ticket
    }
  });
  if (!response.ok) {
    throw new ContentUnavailableError(ref.hash, `HTTP ${response.status}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength !== ref.size) {
    throw new ContentUnavailableError(
      ref.hash,
      `expected ${ref.size} bytes, received ${bytes.byteLength}`
    );
  }

  return bytes;
}

function inlineSnapshot(
  ref: ContentRef,
  room: Room,
  cause: unknown
): Promise<Uint8Array> {
  const { promise, resolve, reject } = Promise.withResolvers<Uint8Array>();
  const timer = setTimeout(() => {
    stop();
    reject(new ContentUnavailableError(
      ref.hash,
      "the room did not answer the inline snapshot request",
      { cause }
    ));
  }, kInlineSnapshotTimeoutMs);
  function stop(): void {
    clearTimeout(timer);
    room.off("message", onMessage);
    room.off("denied", onDenied);
    room.off("left", onLeft);
  }
  function onMessage(
    message: unknown
  ): void {
    if (!isInlineSnapshot(message)) {
      return;
    }

    stop();
    if (message.data instanceof Uint8Array) {
      resolve(message.data);
    }
    else {
      reject(new ContentUnavailableError(
        ref.hash,
        "the inline snapshot holds no bytes",
        { cause }
      ));
    }
  }
  function onDenied(
    event: RoomRejectionEvent
  ): void {
    if (event.event !== ASSET_ROOM_INLINE_SNAPSHOT) {
      return;
    }

    stop();
    reject(new ContentUnavailableError(
      ref.hash,
      `the room denied the inline snapshot: ${event.reason}`,
      { cause }
    ));
  }
  function onLeft(): void {
    stop();
    reject(new ContentUnavailableError(
      ref.hash,
      "the room was left",
      { cause }
    ));
  }

  room.on("message", onMessage);
  room.on("denied", onDenied);
  room.on("left", onLeft);
  room.send({
    action: ASSET_ROOM_INLINE_SNAPSHOT
  });

  return promise;
}

function isInlineSnapshot(
  message: unknown
): message is AssetRoomInlineSnapshotMessage {
  return typeof message === "object" &&
    message !== null &&
    Reflect.get(message, "type") === ASSET_ROOM_INLINE_SNAPSHOT;
}
