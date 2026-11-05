// Import Third-party Dependencies
import {
  SOUND_KIND,
  soundDocumentKind
} from "@jolly-pixel/asset.sound/client";
import {
  bindPresenceStack,
  Teardown,
  type EditorContext,
  type EditorSession
} from "@jolly-pixel/editor.host";
import "@jolly-pixel/editor.host/ui";

// Import Internal Dependencies
import { SoundCollaboration } from "./collaboration/SoundCollaboration.ts";
import { SoundFile } from "./panes/sound/SoundFile.ts";
import { SoundPlayer } from "./player/SoundPlayer.ts";
import { VolumePreference } from "./player/volume/VolumePreference.ts";

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
      if (
        track === null ||
        wave === null ||
        fileFolder === null ||
        details === null
      ) {
        throw new Error("SoundEditor: the page is missing a sound pane.");
      }

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
      track.attach(player, collaboration);
      wave.attach(player, collaboration);
      fileFolder.attach(new SoundFile({
        catalog: session.catalog,
        assetId: session.targetRecord.id,
        document: target.document
      }), context.notifications);
      details.attach(player);

      const presenceStack = document.querySelector("jolly-presence-stack");
      if (presenceStack !== null) {
        teardown.defer(bindPresenceStack(
          presenceStack,
          collaboration,
          (clientId) => collaboration.listenTo(clientId)
        ));
      }

      const ready = target.ready.then(() => {
        void player.follow(target.document);
      });

      return new SoundEditor({
        session,
        player,
        ready,
        teardown
      });
    }
    catch (error) {
      teardown.run();

      throw error;
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
