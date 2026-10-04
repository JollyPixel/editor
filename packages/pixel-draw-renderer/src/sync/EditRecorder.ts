// Import Internal Dependencies
import type { DefaultPixelBuffer } from "../buffer/types.ts";
import type { History } from "../history/History.ts";
import type {
  HistoryEdit,
  HistoryEntry
} from "../history/HistoryEntry.ts";
import type {
  PixelDocumentSnapshot,
  PixelDocumentState
} from "./PixelDocumentState.ts";
import {
  toDocumentCommand,
  toPixelCommand,
  type DocumentCommand,
  type PixelCommand
} from "./PixelCommand.ts";
import type { UVOwnership } from "./UVOwnership.ts";

export interface EditRecorderListeners {
  command: (command: PixelCommand) => void;
  drawEnd: () => void;
  reset: () => void;
}

export interface EditRecorderOptions {
  state: PixelDocumentState<DefaultPixelBuffer>;
  history: History;
  ownership: Pick<UVOwnership, "admits" | "owns">;
  listeners: EditRecorderListeners;
}

export class EditRecorder {
  #state: PixelDocumentState<DefaultPixelBuffer>;
  #history: History;
  #ownership: Pick<UVOwnership, "admits" | "owns">;
  #listeners: EditRecorderListeners;
  #silenced = 0;

  constructor(
    options: EditRecorderOptions
  ) {
    this.#state = options.state;
    this.#history = options.history;
    this.#ownership = options.ownership;
    this.#listeners = options.listeners;
  }

  get recording(): boolean {
    return this.#silenced === 0;
  }

  record(
    emitted: DocumentCommand[],
    edit: HistoryEdit
  ): void {
    if (!this.recording) {
      return;
    }

    this.#history.push(edit);
    this.#broadcast(emitted);
  }

  undo(): HistoryEntry | null {
    return this.#history.undo(
      (entry) => this.#replay(entry.undo, entry.timestamp)
    );
  }

  redo(): HistoryEntry | null {
    return this.#history.redo(
      (entry) => this.#replay(entry.redo, entry.timestamp)
    );
  }

  applyRemote(
    command: PixelCommand
  ): void {
    if (!this.#ownership.admits(command)) {
      return;
    }

    this.silently(() => this.#state.apply(toDocumentCommand(command)));
    switch (command.action) {
      case "stroke":
      case "global-fill":
      case "select-edit":
        this.#listeners.drawEnd();
        break;
      case "resized":
      case "texture-replaced":
        this.#reset();
        break;
      default:
        break;
    }
  }

  load(
    snapshot: PixelDocumentSnapshot
  ): void {
    this.silently(() => this.#state.load(
      snapshot,
      (regionId) => this.#ownership.owns(regionId)
    ));
    this.#reset();
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

  #reset(): void {
    this.#history.clear();
    this.#listeners.reset();
  }

  #replay(
    commands: DocumentCommand[],
    timestamp: number
  ): void {
    this.silently(() => {
      for (const command of commands) {
        this.#state.apply(command);
      }
    });
    this.#broadcast(commands, timestamp);
    this.#listeners.drawEnd();
  }

  #broadcast(
    commands: DocumentCommand[],
    originTimestamp?: number
  ): void {
    if (!this.recording) {
      return;
    }

    for (const command of commands) {
      this.#listeners.command(toPixelCommand(command, originTimestamp));
    }
  }
}
