// Import Third-party Dependencies
import type {
  AssetArbitration,
  AssetLiveProtocol,
  AssetRelay,
  AssetRoomBinding
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type { ScriptText } from "../model/ScriptText.ts";
import { TextEdit } from "../model/TextEdit.ts";
import { EditWindow } from "./EditWindow.ts";
import { scriptSnapshotSchema } from "./ScriptCommand.schema.ts";
import type {
  ScriptNetworkCommand,
  ScriptSnapshot
} from "./types.ts";

export interface ScriptLiveOptions<TRelay extends object> {
  relay?: AssetRelay<TRelay>;
  capacity?: number;
}

export class ScriptLive<
  TRelay extends object = never
> implements AssetLiveProtocol<ScriptNetworkCommand, TRelay> {
  readonly snapshotSchema = scriptSnapshotSchema;
  readonly authorRebases = true;
  readonly relay: AssetRelay<TRelay> | undefined;

  #binding: AssetRoomBinding<ScriptText>;
  #window: EditWindow;

  constructor(
    binding: AssetRoomBinding<ScriptText>,
    options: ScriptLiveOptions<TRelay> = {}
  ) {
    this.#binding = binding;
    this.#window = new EditWindow(this.#version(), options.capacity);
    this.relay = options.relay;
  }

  snapshot(): ScriptSnapshot {
    return {
      text: this.#binding.state.text
    };
  }

  reloaded(): void {
    this.#window.reset(this.#version());
  }

  arbitrate(
    command: ScriptNetworkCommand
  ): AssetArbitration<ScriptNetworkCommand> | null {
    const edit = new TextEdit(command.changes);
    const rebased = this.#window.rebase(edit, command.basis ?? 0);
    if (rebased === null || !rebased.fits(this.#binding.state.text)) {
      return null;
    }

    return {
      command: rebased === edit ?
        command :
        {
          ...command,
          changes: rebased.toJSON()
        },
      commit: (version) => {
        if (version !== undefined) {
          this.#window.record(version, rebased);
        }
      }
    };
  }

  restore(
    command: ScriptNetworkCommand,
    version: number
  ): void {
    this.#window.record(version, new TextEdit(command.changes));
  }

  #version(): number {
    return this.#binding.version?.() ?? 0;
  }
}
