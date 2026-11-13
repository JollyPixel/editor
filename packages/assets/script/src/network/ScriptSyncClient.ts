// Import Third-party Dependencies
import { ChangeReceipts } from "@jolly-pixel/history";
import {
  CommandSync,
  type SentChange
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type {
  ScriptChange,
  ScriptDocument
} from "../model/ScriptDocument.ts";
import { TextEdit } from "../model/TextEdit.ts";
import type {
  ScriptCommand,
  ScriptNetworkCommand,
  ScriptNotice,
  ScriptRoom,
  ScriptSnapshot,
  ScriptStep
} from "./types.ts";
import { UnconfirmedEdits } from "./UnconfirmedEdits.ts";

interface ScriptFlush extends SentChange {
  readonly steps: readonly ScriptStep[];
}

export class ScriptSyncClient extends CommandSync<
  ScriptNetworkCommand,
  ScriptSnapshot,
  ScriptNotice
> {
  readonly receipts = new ChangeReceipts<ScriptStep>();

  #document: ScriptDocument;
  #edits: UnconfirmedEdits;
  #step: ScriptStep | null = null;
  #release: () => void;

  constructor(
    room: ScriptRoom,
    document: ScriptDocument
  ) {
    const edits = new UnconfirmedEdits();
    const flushes = new ChangeReceipts<ScriptFlush>();
    super(room, {
      reconciler: edits,
      receipts: flushes
    });

    this.#document = document;
    this.#edits = edits;
    flushes.subscribe("confirmed", (flush, version) => {
      for (const step of flush.steps) {
        this.receipts.confirm(step, version);
      }
    });
    flushes.subscribe("refused", (flush) => this.#refuse(flush.steps));
    this.on("snapshot", (snapshot) => {
      this.#refuse(edits.forget());
      document.load(snapshot.text);
    });
    this.on("command", (command) => this.#receive(command));
    this.on("acknowledged", (command, version) => {
      if (edits.confirm(command)) {
        this.#flush(version ?? this.version);
      }
    });
    this.#release = document.subscribe("change", (change) => this.#hold(change));
  }

  override destroy(): void {
    this.#release();
    super.destroy();
  }

  applyStep(
    command: ScriptCommand
  ): ScriptStep | null {
    const edit = new TextEdit(command.changes);
    if (edit.empty || !edit.fits(this.#document.text)) {
      return null;
    }

    const step: ScriptStep = { command };
    this.#step = step;
    try {
      this.#document.edit(edit);
    }
    finally {
      this.#step = null;
    }

    return step;
  }

  #receive(
    command: ScriptNetworkCommand
  ): void {
    const remote = this.#edits.rebase(new TextEdit(command.changes));
    if (!remote.fits(this.#document.text)) {
      this.#refuse(this.#edits.forget());
      this.resync();

      return;
    }

    this.#document.applyRemote(remote, command.clientId);
  }

  #hold(
    change: ScriptChange
  ): void {
    if (change.origin === "input" || change.origin === "history") {
      this.#edits.hold(change.edit, this.#step);
      this.#flush(this.version);
    }
  }

  #flush(
    basis: number
  ): void {
    this.#edits.flush((edit, steps) => {
      const flush: ScriptFlush = {
        basis,
        steps
      };

      return this.sendChange(
        {
          action: "edited",
          changes: edit.toJSON()
        },
        flush
      );
    });
  }

  #refuse(
    steps: Iterable<ScriptStep>
  ): void {
    for (const step of steps) {
      this.receipts.refuse(step);
    }
  }
}
