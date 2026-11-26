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
import { SCRIPT_CAPABILITY_TABLE } from "./access/ScriptAccess.ts";
import { ScriptCollaboration } from "./collaboration/ScriptCollaboration.ts";
import { CodeAssist } from "./language/CodeAssist.ts";
import { LanguageClient } from "./language/LanguageClient.ts";
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
      import("./panes/markdown/bindMarkdownPreview.ts") :
      null;
    const shaderPreview = kind === SHADER_KIND ?
      import("./panes/shader/bindShaderPreview.ts") :
      null;

    function keepPreview(
      binding: Promise<() => void>
    ): void {
      binding
        .then((release) => teardown.defer(release))
        .catch((error: unknown) => {
          context.logger.error("preview failed", { error });
        });
    }

    try {
      const editorToolbar = document.querySelector("jolly-editor-toolbar");
      if (editorToolbar !== null) {
        editorToolbar.sources = context.toolbar;
      }
      const code = document.querySelector("jolly-script-code");
      if (code === null) {
        throw new Error("ScriptEditor: the page is missing a script pane.");
      }

      const languageClient = kind === SCRIPT_KIND || kind === SHADER_KIND ?
        new LanguageClient({
          path,
          crashed: (error) => context.logger.error("language service crashed", { error })
        }) :
        null;
      teardown.defer(() => languageClient?.dispose());

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

      const access = context.access.target(SCRIPT_CAPABILITY_TABLE);

      const ready = target.ready.then(() => {
        teardown.defer(code.attach({
          document: target.document,
          collaboration,
          language,
          access
        }));
        if (languageClient !== null) {
          const assist = new CodeAssist({
            questions: languageClient,
            document: target.document,
            room: target.room
          });
          teardown.defer(() => assist.dispose());
          teardown.defer(code.assist(assist));
        }
        if (markdownPreview !== null) {
          keepPreview(markdownPreview.then(({ bindMarkdownPreview }) => bindMarkdownPreview({
            document: target.document,
            code,
            access
          })));
        }
        if (shaderPreview !== null) {
          keepPreview(shaderPreview.then(({ bindShaderPreview }) => bindShaderPreview({
            document: target.document,
            name: path,
            context
          })));
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
