// Import Third-party Dependencies
import { CommandSync } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type {
  ScriptChange,
  ScriptDocument
} from "../model/ScriptDocument.ts";
import { TextEdit } from "../model/TextEdit.ts";
import type {
  ScriptNetworkCommand,
  ScriptNotice,
  ScriptRoom,
  ScriptSnapshot
} from "./types.ts";
import { UnconfirmedEdits } from "./UnconfirmedEdits.ts";

export class ScriptSyncClient extends CommandSync<
  ScriptNetworkCommand,
  ScriptSnapshot,
  ScriptNotice
> {
  #document: ScriptDocument;
  #edits: UnconfirmedEdits;
  #release: () => void;

  constructor(
    room: ScriptRoom,
    document: ScriptDocument
  ) {
    const edits = new UnconfirmedEdits();
    super(room, { reconciler: edits });

    this.#document = document;
    this.#edits = edits;
    this.on("snapshot", (snapshot) => {
      edits.forget();
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

  #receive(
    command: ScriptNetworkCommand
  ): void {
    const remote = this.#edits.rebase(new TextEdit(command.changes));
    if (!remote.fits(this.#document.text)) {
      this.#edits.forget();
      this.resync();

      return;
    }

    this.#document.applyRemote(remote, command.clientId);
  }

  #hold(
    change: ScriptChange
  ): void {
    if (change.origin === "input" || change.origin === "history") {
      this.#edits.hold(change.edit);
      this.#flush(this.version);
    }
  }

  #flush(
    basis: number
  ): void {
    this.#edits.flush((edit) => this.send(
      {
        action: "edited",
        changes: edit.toJSON()
      },
      Date.now(),
      basis
    ));
  }
}
