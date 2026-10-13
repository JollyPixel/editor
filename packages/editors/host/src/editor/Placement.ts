// Import Internal Dependencies
import { forwardConsole } from "../console/forwardConsole.ts";
import {
  mountConsole,
  type PageConsole
} from "../console/mountConsole.ts";
import type { EditorLaunch } from "../launch/EditorLaunch.ts";
import {
  PageHistory,
  type LaunchHistory
} from "../launch/LaunchHistory.ts";
import type { LaunchNavigator } from "../launch/LaunchNavigator.ts";
import type { ShellChannel } from "../launch/ShellChannel.ts";
import { LastOpenedLaunchSource } from "../launch/sources/LastOpenedLaunchSource.ts";
import type { AssetRoomLease } from "../lease/AssetLease.ts";
import type { AssetLeases } from "../lease/AssetLeases.ts";
import {
  EditorTags,
  type EditorTagsCatalog
} from "../session/EditorTags.ts";
import {
  EditorTargets,
  type EditorTargetsCatalog
} from "../session/EditorTargets.ts";
import { EditorToolbarSources } from "../session/EditorToolbarSources.ts";
import type { PageState } from "../state/PageState.ts";
import type { SessionWorkspace } from "../workspace/SessionWorkspace.ts";

export type UnsavedLeases = Pick<AssetLeases, "unsaved" | "subscribe">;

export interface PlacedSession {
  readonly catalog: EditorTargetsCatalog & EditorTagsCatalog;
  readonly workspace: SessionWorkspace | null;
  readonly assets: Pick<AssetLeases, "unsaved">;
  readonly target: Pick<AssetRoomLease, "record">;
}

export class Placement {
  readonly shell: ShellChannel | null;
  readonly shared: boolean;

  constructor(
    launch: EditorLaunch
  ) {
    this.shell = launch.shell;
    this.shared = launch.credential !== null;
  }

  openConsole(): PageConsole {
    return this.shell === null ?
      mountConsole() :
      forwardConsole(this.shell);
  }

  history(): LaunchHistory {
    return new PageHistory(this.shell === null ? "push" : "replace");
  }

  reportState(
    page: Pick<PageState, "follow">,
    signal: AbortSignal
  ): void {
    const { shell } = this;
    if (shell !== null) {
      page.follow((state) => shell.reportState(state), signal);
    }
  }

  guardUnsaved(
    assets: UnsavedLeases,
    signal: AbortSignal
  ): void {
    const { shell } = this;
    if (shell !== null) {
      const unsubscribe = assets.subscribe(
        "unsaved",
        (unsaved) => shell.reportUnsaved(unsaved)
      );
      signal.addEventListener("abort", unsubscribe, { once: true });

      return;
    }

    window.addEventListener("beforeunload", (event) => {
      if (assets.unsaved) {
        event.preventDefault();
      }
    }, { signal });
  }

  toolbar(
    launch: EditorLaunch,
    session: PlacedSession,
    navigator: LaunchNavigator
  ): EditorToolbarSources {
    const { catalog, assets } = session;
    const { id, kind } = session.target.record;

    return new EditorToolbarSources(
      this.shared || this.shell !== null ?
        null :
        new EditorTargets({
          catalog,
          accepts: kind,
          current: id,
          navigator
        }),
      this.shared || session.workspace !== null ?
        null :
        new EditorTags({
          catalog,
          assetId: id,
          viewing: launch.tag,
          unsaved: () => assets.unsaved,
          navigator
        })
    );
  }

  rememberOpened(
    session: PlacedSession
  ): void {
    if (session.workspace !== null) {
      const { kind, id } = session.target.record;
      LastOpenedLaunchSource.remember(kind, id);
    }
  }
}
