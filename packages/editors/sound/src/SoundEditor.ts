// Import Third-party Dependencies
import {
  SOUND_KIND,
  soundDocumentKind
} from "@jolly-pixel/asset.sound/client";
import type {
  EditorContext,
  EditorSession
} from "@jolly-pixel/editor.host";
import "@jolly-pixel/editor.host/ui";
import { bindPresenceStack } from "@jolly-pixel/ui";
import { Teardown } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { SoundCollaboration } from "./collaboration/SoundCollaboration.ts";
import { SoundFile } from "./panes/sound/SoundFile.ts";
import { SoundPlayer } from "./player/SoundPlayer.ts";
import { VolumePreference } from "./player/volume/VolumePreference.ts";
import { LiveSettings } from "./settings/LiveSettings.ts";

// CONSTANTS
const kSoundKind = soundDocumentKind();

export interface SoundEditorParts {
  session: EditorSession;
  player: SoundPlayer;
  ready: Promise<void>;
  teardown: Teardown;
}

export class SoundEditor {
  static readonly accepts = SOUND_KIND;
  static readonly identity = {
    title: "Join sound"
  };
  static readonly kinds = [kSoundKind];
  static readonly archive = {
    fallbackName: "sound",
    resetWarning: "Every sound stored in this browser is deleted. " +
      "Export what you want to keep first."
  };

  static async mount(
    context: EditorContext
  ): Promise<SoundEditor> {
    const { session } = context;
    const target = session.targetLease(kSoundKind);
    const teardown = new Teardown();

    try {
      const editorToolbar = document.querySelector("jolly-editor-toolbar");
      if (editorToolbar !== null) {
        editorToolbar.sources = context.toolbar;
      }
      const track = document.querySelector("jolly-sound-track");
      const wave = document.querySelector("jolly-sound-wave");
      const fileFolder = document.querySelector("jolly-sound-file");
      const details = document.querySelector("jolly-sound-details");
      const settings = document.querySelector("jolly-sound-settings");
      const spatial = document.querySelector("jolly-sound-spatial");
      if (
        track === null ||
        wave === null ||
        fileFolder === null ||
        details === null ||
        settings === null ||
        spatial === null
      ) {
        throw new Error("SoundEditor: the page is missing a sound pane.");
      }

      const liveSettings = new LiveSettings(target.document);
      teardown.defer(() => liveSettings.dispose());
      const player = new SoundPlayer(
        new AudioContext()
      );
      teardown.defer(() => player.dispose());
      teardown.defer(
        new VolumePreference(context.preferences).follow(player)
      );
      const collaboration = new SoundCollaboration({
        room: target.room,
        player
      });
      teardown.defer(() => collaboration.dispose());
      track.attach(player, collaboration, liveSettings);
      wave.attach(player, collaboration);
      fileFolder.attach(new SoundFile({
        catalog: session.catalog,
        assetId: session.targetRecord.id,
        document: target.document
      }), context.notifications);
      details.attach(player);
      settings.attach(liveSettings, player, collaboration);
      spatial.attach(player, collaboration, liveSettings);
      const spatialDock = spatial.closest("jolly-dock");
      if (spatialDock !== null) {
        teardown.defer(showWhileSpatial(spatialDock, player));
      }

      const presenceStack = document.querySelector("jolly-presence-stack");
      if (presenceStack !== null) {
        teardown.defer(bindPresenceStack(
          presenceStack,
          collaboration,
          (clientId) => collaboration.listenTo(clientId)
        ));
      }

      const ready = target.ready.then(() => {
        void player.follow(liveSettings);
      });

      return new SoundEditor({
        session,
        player,
        ready,
        teardown
      });
    }
    catch (error) {
      throw teardown.unwind(error);
    }
  }

  #teardown: Teardown;

  readonly ready: Promise<void>;
  readonly runtime = null;
  readonly session: EditorSession;
  readonly player: SoundPlayer;

  constructor(
    parts: SoundEditorParts
  ) {
    this.session = parts.session;
    this.player = parts.player;
    this.ready = parts.ready;
    this.#teardown = parts.teardown;
  }

  dispose(): void {
    this.#teardown.run();
  }
}

function showWhileSpatial(
  dock: HTMLElement,
  player: SoundPlayer
): () => void {
  function show(): void {
    dock.hidden = !player.mode.spatial;
  }
  show();

  return player.subscribe("change", show);
}
