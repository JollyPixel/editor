// Import Third-party Dependencies
import {
  SCRIPT_KIND,
  ScriptOutlineFeed,
  scriptDocumentKind,
  type ScriptDocument
} from "@jolly-pixel/asset.script/client";
import {
  bindPresenceStack,
  Teardown,
  type EditorContext,
  type EditorSession
} from "@jolly-pixel/editor.host";
import "@jolly-pixel/editor.host/ui";

// Import Internal Dependencies
import { ScriptCollaboration } from "./collaboration/ScriptCollaboration.ts";
import type { ScriptLanguage } from "./code/ScriptHighlighter.ts";
import { OutlineRefresh } from "./outline/OutlineRefresh.ts";

// CONSTANTS
const kScriptKind = scriptDocumentKind();

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
  static readonly kinds = [kScriptKind];
  static readonly archive = {
    fallbackName: "script",
    resetWarning: "Every script stored in this browser is deleted. " +
      "Export what you want to keep first."
  };

  static async mount(
    context: EditorContext
  ): Promise<ScriptEditor> {
    const { session } = context;
    const target = session.targetLease(kScriptKind);
    const teardown = new Teardown();

    try {
      const editorToolbar = document.querySelector("jolly-editor-toolbar");
      if (editorToolbar !== null) {
        editorToolbar.sources = context.toolbar;
      }
      const code = document.querySelector("jolly-script-code");
      const outlinePane = document.querySelector("jolly-script-outline");
      if (code === null || outlinePane === null) {
        throw new Error("ScriptEditor: the page is missing a script pane.");
      }

      const collaboration = new ScriptCollaboration({
        room: target.room,
        document: target.document
      });
      teardown.defer(() => collaboration.dispose());
      const outline = new ScriptOutlineFeed(target.room);
      teardown.defer(() => outline.dispose());
      const refresh = new OutlineRefresh(target.document, outline);
      teardown.defer(() => refresh.dispose());
      outlinePane.attach(outline);

      const presenceStack = document.querySelector("jolly-presence-stack");
      if (presenceStack !== null) {
        teardown.defer(bindPresenceStack(
          presenceStack,
          collaboration,
          () => code.focusEditor()
        ));
      }

      const ready = target.ready.then(() => {
        teardown.defer(code.attach({
          document: target.document,
          collaboration,
          language: scriptLanguage(session.targetRecord.path),
          readOnly: target.room.access !== "write"
        }));
        outline.request();
      });

      return new ScriptEditor({
        session,
        document: target.document,
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

function scriptLanguage(
  path: string
): ScriptLanguage {
  return path.endsWith(".js") ? "javascript" : "typescript";
}
