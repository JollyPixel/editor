// Import Third-party Dependencies
import {
  SCRIPT_KIND,
  ScriptOutlineFeed,
  TEXT_KIND,
  textDocumentKind,
  type ScriptDocument,
  type ScriptRoom
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
import { fileLanguage } from "./panes/code/ScriptHighlighter.ts";
import { OutlineRefresh } from "./panes/outline/OutlineRefresh.ts";
import type { ScriptOutlinePane } from "./panes/outline/ScriptOutlinePane.ts";
import { bindMarkdownPreview } from "./panes/preview/bindMarkdownPreview.ts";

// CONSTANTS
const kScriptKind = textDocumentKind(SCRIPT_KIND);
const kTextKind = textDocumentKind(TEXT_KIND);

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
  static readonly kinds = [kScriptKind, kTextKind];
  static readonly archive = {
    fallbackName: "script",
    resetWarning: "Every script stored in this browser is deleted. " +
      "Export what you want to keep first."
  };

  static async mount(
    context: EditorContext
  ): Promise<ScriptEditor> {
    const { session } = context;
    const { kind, path } = session.targetRecord;
    const target = session.targetLease(kScriptKind, kTextKind);
    const language = fileLanguage(path);
    const teardown = new Teardown();

    try {
      const editorToolbar = document.querySelector("jolly-editor-toolbar");
      if (editorToolbar !== null) {
        editorToolbar.sources = context.toolbar;
      }
      const code = document.querySelector("jolly-script-code");
      const outlinePane = document.querySelector("jolly-script-outline");
      const preview = document.querySelector("jolly-markdown");
      if (code === null || outlinePane === null || preview === null) {
        throw new Error("ScriptEditor: the page is missing a script pane.");
      }

      const collaboration = new ScriptCollaboration({
        room: target.room,
        document: target.document
      });
      teardown.defer(() => collaboration.dispose());
      let outline: ScriptOutlineFeed | null = null;
      if (kind === SCRIPT_KIND) {
        outline = attachOutline(target.room, target.document, outlinePane, teardown);
      }
      else {
        outlinePane.closest("jolly-dock")?.remove();
      }

      const presenceStack = document.querySelector("jolly-presence-stack");
      if (presenceStack !== null) {
        teardown.defer(bindPresenceStack(
          presenceStack,
          collaboration,
          () => code.focusEditor()
        ));
      }

      const ready = target.ready.then(() => {
        const readOnly = target.room.access !== "write";
        teardown.defer(code.attach({
          document: target.document,
          collaboration,
          language,
          readOnly
        }));
        if (language === "markdown") {
          code.hidden = readOnly;
          teardown.defer(bindMarkdownPreview(preview, target.document));
        }
        outline?.request();
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

function attachOutline(
  room: ScriptRoom,
  document: ScriptDocument,
  pane: ScriptOutlinePane,
  teardown: Teardown
): ScriptOutlineFeed {
  const outline = new ScriptOutlineFeed(room);
  teardown.defer(() => outline.dispose());
  const refresh = new OutlineRefresh(document, outline);
  teardown.defer(() => refresh.dispose());
  pane.attach(outline);

  return outline;
}
