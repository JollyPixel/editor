// Import Third-party Dependencies
import { TEXTURE_KIND } from "@jolly-pixel/asset-server";
import type {
  EditorContext,
  EditorSession
} from "@jolly-pixel/editor.host";
import "@jolly-pixel/editor.host/ui";
import { Teardown } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { textureDocumentKind } from "./document/TextureDocument.ts";
import { TextureFile } from "./file/TextureFile.ts";
import { TexturePreview } from "./image/TexturePreview.ts";

// CONSTANTS
const kTextureKind = textureDocumentKind();

export interface TextureEditorParts {
  session: EditorSession;
  preview: TexturePreview;
  ready: Promise<void>;
  teardown: Teardown;
}

export class TextureEditor {
  static readonly accepts = TEXTURE_KIND;
  static readonly identity = {
    title: "Join texture"
  };
  static readonly kinds = [kTextureKind];
  static readonly archive = {
    fallbackName: "texture",
    resetWarning: "Every texture stored in this browser is deleted. " +
      "Export what you want to keep first."
  };

  static async mount(
    context: EditorContext
  ): Promise<TextureEditor> {
    const { session } = context;
    const target = session.targetLease(kTextureKind);
    const teardown = new Teardown();

    try {
      const editorToolbar = document.querySelector("jolly-editor-toolbar");
      if (editorToolbar !== null) {
        editorToolbar.sources = context.toolbar;
      }
      const stage = document.querySelector("jolly-texture-stage");
      const fileFolder = document.querySelector("jolly-texture-file");
      const details = document.querySelector("jolly-texture-details");
      if (
        stage === null ||
        fileFolder === null ||
        details === null
      ) {
        throw new Error("TextureEditor: the page is missing a texture pane.");
      }

      const file = new TextureFile(session, target.document);
      const preview = new TexturePreview(file);
      fileFolder.attach(file, context.notifications);
      details.attach(preview);
      stage.attach(preview);

      const ready = target.ready.then(() => {
        if (!teardown.signal.aborted) {
          teardown.defer(preview.follow());
        }
      });

      return new TextureEditor({
        session,
        preview,
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
  readonly preview: TexturePreview;

  constructor(
    parts: TextureEditorParts
  ) {
    this.session = parts.session;
    this.preview = parts.preview;
    this.ready = parts.ready;
    this.#teardown = parts.teardown;
  }

  dispose(): void {
    this.#teardown.run();
  }
}
