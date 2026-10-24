// Import Third-party Dependencies
import { KeyboardLayoutStore } from "@jolly-pixel/controls";
import type { Lantern } from "@jolly-pixel/lantern";
import { ColorPicker } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { forwardConsole } from "../console/forwardConsole.ts";
import {
  mountConsole,
  type PageConsole
} from "../console/mountConsole.ts";
import type { HostLogger } from "../debug/readDebugLogger.ts";
import type { EditorLaunch } from "../launch/EditorLaunch.ts";
import {
  PageHistory,
  type LaunchHistory
} from "../launch/LaunchHistory.ts";
import type { ShellChannel } from "../shell/ShellChannel.ts";
import { LocalPreferences } from "../preferences/store/LocalPreferences.ts";
import { Preferences } from "../preferences/store/Preferences.ts";
import {
  CAMERA_PREFERENCES,
  LANTERN_PREFERENCES
} from "../preferences/scope/hostPreferences.ts";
import { PreferenceStorage } from "../preferences/adapters/PreferenceStorage.ts";
import { followColorPickerPreferences } from "../preferences/adapters/followColorPickerPreferences.ts";
import { LastOpenedLaunchSource } from "../launch/sources/LastOpenedLaunchSource.ts";
import type { AssetRoomLease } from "../lease/AssetLease.ts";
import type { AssetLeases } from "../lease/AssetLeases.ts";
import type { ConnectionStatus } from "../connection/ConnectionStatus.ts";
import {
  EditorTags,
  type EditorTagsCatalog
} from "../session/EditorTags.ts";
import {
  EditorTargets,
  type EditorTargetsCatalog
} from "../session/EditorTargets.ts";
import { EditorToolbarSources } from "../session/EditorToolbarSources.ts";
import { mountLantern } from "../ui/lantern/mountLantern.ts";
import { provideTourKeys } from "../ui/lantern/provideTourKeys.ts";
import type { EditorContext } from "./EditorDefinition.ts";
import type { MountRequest } from "./MountedEditor.ts";
import type { PageState } from "./PageState.ts";
import { Teardown } from "./Teardown.ts";
import type { OfflineMode } from "../connection/OfflineMode.ts";

export type UnsavedLeases = Pick<AssetLeases, "unsaved" | "subscribe">;

export interface PlacedSession {
  readonly catalog: EditorTargetsCatalog & EditorTagsCatalog;
  readonly offline: OfflineMode | null;
  readonly assets: Pick<AssetLeases, "unsaved">;
  readonly connectionStatus: ConnectionStatus | null;
  readonly target: Pick<AssetRoomLease, "record">;
}

export interface PlacedRequest extends Omit<MountRequest, "session"> {
  readonly session: PlacedSession;
}

export type PlacedContext = Pick<
  EditorContext,
  | "toolbar"
  | "shell"
  | "commands"
  | "lantern"
  | "preferences"
  | "keyboardLayout"
>;

export interface PlacementOptions {
  page: Pick<PageState, "follow">;
  logger: HostLogger;
}

export class Placement {
  readonly history: LaunchHistory;

  readonly #shell: ShellChannel | null;
  readonly #shared: boolean;
  readonly #keyboardLayout = new KeyboardLayoutStore();
  readonly #teardown = new Teardown();
  readonly #console: PageConsole;
  readonly #preferences: Preferences;
  readonly #lantern: Lantern;

  constructor(
    launch: EditorLaunch,
    options: PlacementOptions
  ) {
    const shell = launch.shell;
    const teardown = this.#teardown;
    this.#shell = shell;
    this.#shared = launch.credential !== null;
    this.history = new PageHistory(shell === null ? "push" : "replace");
    try {
      this.#reportState(options.page);
      const pageConsole = shell === null ?
        mountConsole({
          logger: options.logger.child({ namespace: "host.console" })
        }) :
        forwardConsole(shell);
      teardown.defer(() => pageConsole.dispose());
      this.#console = pageConsole;
      this.#preferences = this.#openPreferences();
      const pageLantern = mountLantern({
        commands: pageConsole.commands,
        storage: new PreferenceStorage(
          this.#preferences,
          LANTERN_PREFERENCES,
          "seen"
        ),
        logger: options.logger.child({ namespace: "host.lantern" })
      });
      teardown.defer(() => pageLantern.dispose());
      this.#lantern = pageLantern.lantern;
      teardown.defer(this.#keyboardLayout.watch(window));
      teardown.defer(provideTourKeys({
        lantern: this.#lantern,
        preferences: this.#preferences,
        scope: CAMERA_PREFERENCES,
        layout: this.#keyboardLayout
      }));
      teardown.defer(followColorPickerPreferences(
        ColorPicker,
        this.#preferences
      ));
    }
    catch (error) {
      this.dispose();

      throw error;
    }
  }

  context(
    request: PlacedRequest
  ): PlacedContext {
    const toolbar = this.#toolbar(request);
    request.own(() => toolbar.dispose());
    const preferences = this.#preferences.view();
    request.own(() => preferences.dispose());

    return {
      toolbar,
      shell: this.#shell,
      commands: this.#console.commands,
      lantern: this.#lantern,
      preferences,
      keyboardLayout: this.#keyboardLayout
    };
  }

  guardUnsaved(
    assets: UnsavedLeases
  ): void {
    const shell = this.#shell;
    if (shell !== null) {
      this.#teardown.defer(assets.subscribe(
        "unsaved",
        (unsaved) => shell.reportUnsaved(unsaved)
      ));

      return;
    }

    window.addEventListener("beforeunload", (event) => {
      if (assets.unsaved) {
        event.preventDefault();
      }
    }, { signal: this.#teardown.signal });
  }

  rememberOpened(
    session: Pick<PlacedSession, "offline" | "target">
  ): void {
    if (session.offline !== null) {
      const { kind, id } = session.target.record;
      LastOpenedLaunchSource.remember(kind, id);
    }
  }

  dispose(): void {
    this.#teardown.run();
  }

  #toolbar(
    request: PlacedRequest
  ): EditorToolbarSources {
    const { launch, session, navigator } = request;
    const { catalog, assets } = session;
    const { id, kind } = session.target.record;

    return new EditorToolbarSources({
      targets: this.#shared || this.#shell !== null ?
        null :
        new EditorTargets({
          catalog,
          accepts: kind,
          current: id,
          navigator
        }),
      tags: this.#shared || session.offline !== null ?
        null :
        new EditorTags({
          catalog,
          assetId: id,
          viewing: launch.tag,
          unsaved: () => assets.unsaved,
          navigator
        }),
      connectionStatus: session.connectionStatus,
      lantern: this.#lantern
    });
  }

  #reportState(
    page: Pick<PageState, "follow">
  ): void {
    const shell = this.#shell;
    if (shell !== null) {
      page.follow(
        (state) => shell.reportState(state),
        this.#teardown.signal
      );
    }
  }

  #openPreferences(): Preferences {
    const shell = this.#shell;
    if (shell === null) {
      const local = new LocalPreferences();
      this.#teardown.defer(() => local[Symbol.dispose]());

      return local.preferences;
    }

    const preferences = new Preferences({
      overrides: Object.entries(shell.preferences),
      write: (change) => shell.updatePreferences(change.scope, change.patch)
    });
    shell.onPreferences(
      (scope, overrides) => preferences.receive(scope, overrides),
      this.#teardown.signal
    );

    return preferences;
  }
}
