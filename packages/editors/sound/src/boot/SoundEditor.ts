// Import Third-party Dependencies
import {
  SOUND_KIND,
  soundDocumentKind
} from "@jolly-pixel/asset.sound/client";
import {
  Teardown,
  type EditorContext,
  type EditorSession
} from "@jolly-pixel/editor.host";
import "@jolly-pixel/editor.host/ui";

// Import Internal Dependencies
import { SoundPlayer } from "../playback/SoundPlayer.ts";

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
      if (track === null) {
        throw new Error("SoundEditor: \"jolly-sound-track\" is missing from the page.");
      }

      const player = new SoundPlayer(
        new AudioContext()
      );
      teardown.defer(() => player.dispose());
      track.attach(player);

      const ready = target.ready.then(
        () => player.follow(target.document)
      );

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
