// Import Third-party Dependencies
import type { AssetRoomNotice } from "@jolly-pixel/asset-server";
import { resolveBinarySnapshot } from "@jolly-pixel/asset-server/client";
import {
  CommandDocument,
  KeyedGuard,
  type CommandState,
  type HistoryRegistration
} from "@jolly-pixel/history";
import {
  commandDocumentKind,
  type CommandDocumentKind,
  type EditableDocumentKind,
  type SyncedCommandDocument,
  type SyncedDocumentRoom
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { SOUND_KIND } from "../asset/sound.ts";
import {
  changedSettings,
  SoundState
} from "../model/SoundState.ts";
import {
  soundCommandProtocol,
  soundCommandSchema
} from "./SoundCommand.schema.ts";
import type {
  SoundCommand,
  SoundSettings,
  SoundSettingsChange
} from "./types.ts";

// CONSTANTS
const kDefaultHistoryId = "sound";

export interface SoundImage {
  readonly before: SoundSettingsChange;
}

export interface SoundHistoryOptions<TScope extends string> {
  /**
   * @default "sound"
   */
  id?: string;
  scope: TScope;
}

export class SoundDocument extends CommandDocument<
  SoundCommand,
  Uint8Array,
  SoundImage
> {
  readonly #state: SoundState;

  constructor() {
    const state = new SoundState();
    super(soundCommandState(state));
    this.#state = state;
  }

  get bytes(): Uint8Array | null {
    return this.#state.empty ? null : this.#state.bytes;
  }

  get settings(): Readonly<SoundSettings> {
    return this.#state.settings;
  }

  change(
    change: SoundSettingsChange
  ): boolean {
    return this.commit({
      action: "sound-settings-changed",
      set: change
    });
  }

  history<TScope extends string>(
    options: SoundHistoryOptions<TScope>
  ): HistoryRegistration<TScope, SoundCommand, SoundImage> {
    const { id = kDefaultHistoryId, scope } = options;

    return {
      id,
      document: this,
      keys: {
        written: ({ command }) => changedSettings(command.set),
        guard: (commands) => new KeyedGuard(commands.flatMap(
          (command) => changedSettings(command.set).map((key) => {
            return {
              key,
              read: () => this.#state.settings[key]
            };
          })
        ))
      },
      resolveScope: () => scope,
      label: () => "Edit sound settings"
    };
  }
}

export type SyncedSoundDocument = SyncedCommandDocument<
  SoundDocument,
  AssetRoomNotice
>;

export type SoundDocumentKind = CommandDocumentKind<
  typeof SOUND_KIND,
  SoundDocument,
  AssetRoomNotice
>;

export type SoundEditableKind = EditableDocumentKind<
  typeof SOUND_KIND,
  SyncedDocumentRoom<SoundDocument, AssetRoomNotice>,
  SyncedSoundDocument,
  SoundCommand
>;

export function soundDocumentKind(): SoundDocumentKind {
  return commandDocumentKind({
    kind: SOUND_KIND,
    createDocument: () => new SoundDocument(),
    keys: (command) => changedSettings(command.set),
    resolveSnapshot: resolveBinarySnapshot
  });
}

export function soundEditableKind(): SoundEditableKind {
  return {
    ...soundDocumentKind(),
    commandSchema: soundCommandSchema,
    commandProtocol: soundCommandProtocol,
    localEdits: (synced) => synced.document
  };
}

function soundCommandState(
  state: SoundState
): CommandState<SoundCommand, Uint8Array, SoundImage> {
  return {
    accepts: () => state.editable,
    placeable: (command) => command,
    apply: (command) => state.applyCommand(command),
    load: (bytes) => state.load(bytes),
    captureImage: (command) => {
      return {
        before: state.current(command.set)
      };
    },
    invert: (command) => [{
      action: "sound-settings-changed",
      set: state.current(command.set)
    }],
    restored: (images) => state.bytesWith(images.reduceRight<SoundSettings>(
      (settings, { before }) => {
        return {
          ...settings,
          ...before
        };
      },
      state.settings
    ))
  };
}
