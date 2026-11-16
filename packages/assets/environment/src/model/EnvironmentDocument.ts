// Import Third-party Dependencies
import {
  CommandDocument,
  KeyedGuard,
  type CommandState,
  type HistoryRegistration
} from "@jolly-pixel/history";

// Import Internal Dependencies
import {
  changedSections,
  environmentWriteKeys,
  EnvironmentState
} from "./EnvironmentState.ts";
import type {
  EnvironmentChange,
  EnvironmentCommand,
  EnvironmentFile
} from "../network/types.ts";

// CONSTANTS
const kDefaultHistoryId = "environment";

export interface EnvironmentImage {
  readonly before: EnvironmentChange;
}

export interface EnvironmentHistoryOptions<TScope extends string> {
  /**
   * @default "environment"
   */
  id?: string;
  scope: TScope;
}

export class EnvironmentDocument extends CommandDocument<
  EnvironmentCommand,
  EnvironmentFile,
  EnvironmentImage
> {
  readonly #state: EnvironmentState;

  constructor() {
    const state = new EnvironmentState();
    super(environmentCommandState(state));
    this.#state = state;
  }

  get file(): Readonly<EnvironmentFile> {
    return this.#state.file;
  }

  change(
    change: EnvironmentChange
  ): boolean {
    return this.commit({
      action: "environment-changed",
      set: change
    });
  }

  history<TScope extends string>(
    options: EnvironmentHistoryOptions<TScope>
  ): HistoryRegistration<TScope, EnvironmentCommand, EnvironmentImage> {
    const { id = kDefaultHistoryId, scope } = options;

    return {
      id,
      document: this,
      keys: {
        written: ({ command }) => environmentWriteKeys(command),
        guard: (commands) => new KeyedGuard(commands.flatMap(
          (command) => changedSections(command.set).map((section) => {
            return {
              key: section,
              read: () => this.#state.file[section]
            };
          })
        ))
      },
      resolveScope: () => scope,
      label: () => "Edit environment"
    };
  }
}

function environmentCommandState(
  state: EnvironmentState
): CommandState<EnvironmentCommand, EnvironmentFile, EnvironmentImage> {
  return {
    accepts: () => true,
    placeable: (command) => command,
    apply: (command) => state.applyCommand(command),
    load: (file) => state.load(file),
    captureImage: (command) => {
      return {
        before: state.current(command.set)
      };
    },
    invert: (command) => [{
      action: "environment-changed",
      set: state.current(command.set)
    }],
    restored: (images) => {
      let file = state.snapshot();
      for (const { before } of [...images].reverse()) {
        file = {
          ...file,
          ...structuredClone(before)
        };
      }

      return file;
    }
  };
}
