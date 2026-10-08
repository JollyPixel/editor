// Import Internal Dependencies
import type { DefaultPixelBuffer } from "../buffer/types.ts";
import type {
  PixelDocumentSnapshot,
  PixelDocumentState
} from "./PixelDocumentState.ts";
import {
  strokeOf,
  toDocumentCommand,
  toPixelCommand,
  type DocumentCommand,
  type PixelCommand
} from "./PixelCommand.ts";
import type {
  LocalEdit,
  PixelChange
} from "./LocalEdit.types.ts";
import type { UVOwnership } from "./UVOwnership.ts";
import { EditChange } from "./EditChange.ts";

export type EditGrouping = <T>(edit: () => T) => T;

export interface EditRecorderListeners {
  change: (change: PixelChange) => void;
  command: (command: PixelCommand, change: PixelChange) => void;
  drawEnd: () => void;
  load: () => void;
}

export interface EditRecorderOptions {
  state: PixelDocumentState<DefaultPixelBuffer>;
  ownership: Pick<UVOwnership, "admits" | "owns">;
  listeners: EditRecorderListeners;
}

export class EditRecorder {
  #state: PixelDocumentState<DefaultPixelBuffer>;
  #ownership: Pick<UVOwnership, "admits" | "owns">;
  #listeners: EditRecorderListeners;
  #silenced = 0;
  #groupings = new Set<EditGrouping>();

  constructor(
    options: EditRecorderOptions
  ) {
    this.#state = options.state;
    this.#ownership = options.ownership;
    this.#listeners = options.listeners;
  }

  get recording(): boolean {
    return this.#silenced === 0;
  }

  record(
    edit: LocalEdit
  ): void {
    if (!this.recording) {
      return;
    }

    this.#emit(
      EditChange.local(edit.command, edit.inverse),
      edit.sent ?? edit.command
    );
  }

  batch<T>(
    edit: () => T
  ): T {
    let grouped = edit;
    for (const grouping of this.#groupings) {
      const inner = grouped;
      grouped = () => grouping(inner);
    }

    return grouped();
  }

  groupWith(
    grouping: EditGrouping
  ): () => void {
    this.#groupings.add(grouping);

    return () => {
      this.#groupings.delete(grouping);
    };
  }

  applyStep(
    command: DocumentCommand
  ): PixelChange | null {
    if (!this.#state.accepts(command)) {
      return null;
    }

    const inverse = this.#state.inverseOf(command);
    this.silently(() => this.#state.apply(command));
    const change = EditChange.local(command, inverse);
    this.#emit(change, command);
    this.#listeners.drawEnd();

    return change;
  }

  applyRemote(
    command: PixelCommand,
    clientId: string | null
  ): void {
    this.#applyPeer(
      command,
      (written) => EditChange.remote(written, clientId)
    );
  }

  replayPending(
    command: PixelCommand
  ): void {
    this.#applyPeer(
      command,
      (written) => EditChange.replay(written)
    );
  }

  load(
    snapshot: PixelDocumentSnapshot
  ): void {
    this.silently(() => this.#state.load(
      snapshot,
      (regionId) => this.#ownership.owns(regionId)
    ));
    this.#listeners.load();
  }

  silently<T>(
    fn: () => T
  ): T {
    this.#silenced++;
    try {
      return fn();
    }
    finally {
      this.#silenced--;
    }
  }

  #applyPeer(
    command: PixelCommand,
    changeOf: (written: DocumentCommand) => PixelChange
  ): void {
    if (!this.#ownership.admits(command)) {
      return;
    }

    const written = this.#written(toDocumentCommand(command));
    this.silently(() => this.#state.apply(written));
    this.#listeners.change(changeOf(written));
    switch (command.action) {
      case "stroke":
      case "global-fill":
      case "select-edit":
        this.#listeners.drawEnd();
        break;
      default:
        break;
    }
  }

  #written(
    command: DocumentCommand
  ): DocumentCommand {
    if (command.action !== "global-fill") {
      return command;
    }

    const { fromColor, toColor } = command.metadata;

    return strokeOf(this.#state.buffer.positionsOf(fromColor), toColor);
  }

  #emit(
    change: PixelChange,
    sent: DocumentCommand
  ): void {
    this.#listeners.change(change);
    this.#listeners.command(toPixelCommand(sent), change);
  }
}
