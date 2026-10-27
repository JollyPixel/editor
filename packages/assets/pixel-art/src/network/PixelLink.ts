// Import Third-party Dependencies
import type { CommandSync } from "@jolly-pixel/network/client";
import type { ChangeSource } from "@jolly-pixel/history";
import type {
  PixelDocumentCommand,
  PixelChange,
  PixelCommand,
  PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type {
  PixelWireCommand,
  PixelWireEvent,
  PixelWireSnapshot
} from "./types.ts";
import {
  packPixelEvent,
  unpackPixelCommand
} from "./PixelWireCodec.ts";
import type { PixelEdits } from "../history/PixelEdits.ts";

export type PixelCommandListener = (
  command: PixelCommand,
  change: PixelChange
) => void;

export interface PixelSyncTarget extends Pick<
  PixelDocument,
  "applyRemoteCommand" | "replayPendingCommand" | "loadSnapshot"
>, ChangeSource<PixelDocumentCommand> {
  on(
    event: "command",
    listener: PixelCommandListener
  ): unknown;
  off(
    event: "command",
    listener: PixelCommandListener
  ): unknown;
}

type SentChange = Parameters<
  CommandSync<PixelWireCommand, PixelWireSnapshot>["sendChange"]
>[1];

export interface PixelChangeSender {
  sendChange(
    body: PixelWireEvent,
    change: SentChange
  ): unknown;
}

export class PixelLink {
  #target: PixelSyncTarget;
  #send: PixelCommandListener;

  constructor(
    target: PixelSyncTarget,
    edits: PixelEdits,
    sender: PixelChangeSender
  ) {
    this.#target = target;
    this.#send = (command, change) => {
      sender.sendChange(packPixelEvent(command), edits.adapt(change));
    };
    target.on("command", this.#send);
  }

  applyRemote(
    command: PixelWireCommand
  ): void {
    this.#target.applyRemoteCommand(
      unpackPixelCommand(command),
      command.clientId
    );
  }

  dispose(): void {
    this.#target.off("command", this.#send);
  }
}
