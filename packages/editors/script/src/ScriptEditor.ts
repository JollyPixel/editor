// Import Third-party Dependencies
import {
  SCRIPT_KIND,
  SHADER_KIND,
  TEXT_KIND,
  textDocumentKind,
  type ScriptDocument
} from "@jolly-pixel/asset.script/client";
import type {
  EditorContext,
  EditorSession
} from "@jolly-pixel/editor.host";
import "@jolly-pixel/editor.host/ui";
import { bindPresenceStack } from "@jolly-pixel/ui";
import { Teardown } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { ScriptCollaboration } from "./collaboration/ScriptCollaboration.ts";
import { fileLanguage } from "./syntax/highlight.ts";

// CONSTANTS
const kScriptKind = textDocumentKind(SCRIPT_KIND);
const kTextKind = textDocumentKind(TEXT_KIND);
const kShaderKind = textDocumentKind(SHADER_KIND);

export interface ScriptEditorParts {
  session: EditorSession;
  document: ScriptDocument;
  ready: Promise<void>;
  teardown: Teardown;
}

export class ScriptEditor {
  static readonly accepts = SCRIPT_KIND;
  static readonly identity = {
    title: "Join script"
  };
  static readonly kinds = [kScriptKind, kTextKind, kShaderKind];
  static readonly archive = {
    fallbackName: "script",
    resetWarning: "Every script stored in this browser is deleted. " +
      "Export what you want to keep first."
  };

  static async mount(
    context: EditorContext
  ): Promise<ScriptEditor> {
    const { session } = context;
    const { path, kind } = session.targetRecord;
    const target = session.targetLease(kScriptKind, kTextKind, kShaderKind);
    const language = fileLanguage(path);
    const teardown = new Teardown();
    const markdownPreview = language === "markdown" ?
      import("./panes/preview/bindMarkdownPreview.ts") :
      null;
    const shaderPreview = kind === SHADER_KIND ?
      import("./panes/shader/bindShaderPreview.ts") :
      null;

    try {
      const editorToolbar = document.querySelector("jolly-editor-toolbar");
      if (editorToolbar !== null) {
        editorToolbar.sources = context.toolbar;
      }
      const code = document.querySelector("jolly-script-code");
      const preview = document.querySelector("jolly-markdown");
      const shaderView = document.querySelector<HTMLElement>("#shader-preview");
      if (code === null || preview === null || shaderView === null) {
        throw new Error("ScriptEditor: the page is missing a script pane.");
      }

      const collaboration = new ScriptCollaboration({
        room: target.room,
        document: target.document
      });
      teardown.defer(() => collaboration.dispose());

      const presenceStack = document.querySelector("jolly-presence-stack");
      if (presenceStack !== null) {
        teardown.defer(bindPresenceStack(
          presenceStack,
          collaboration,
          () => code.focusEditor()
        ));
      }

      const ready = target.ready.then(async() => {
        const readOnly = target.room.access !== "write";
        teardown.defer(code.attach({
          document: target.document,
          collaboration,
          language,
          readOnly
        }));
        if (markdownPreview !== null) {
          code.hidden = readOnly;
          const { bindMarkdownPreview } = await markdownPreview;
          teardown.defer(bindMarkdownPreview(preview, target.document));
        }
        if (shaderPreview !== null) {
          shaderView.hidden = false;
          void shaderPreview
            .then(({ bindShaderPreview }) => bindShaderPreview({
              view: shaderView,
              document: target.document,
              name: path,
              context
            }))
            .then((release) => teardown.defer(release))
            .catch((error: unknown) => {
              shaderView.hidden = true;
              context.logger.error("shader preview failed", { error });
            });
        }
      });

      return new ScriptEditor({
        session,
        document: target.document,
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
  readonly document: ScriptDocument;

  constructor(
    parts: ScriptEditorParts
  ) {
    this.session = parts.session;
    this.document = parts.document;
    this.ready = parts.ready;
    this.#teardown = parts.teardown;
  }

  dispose(): void {
    this.#teardown.run();
  }
}
