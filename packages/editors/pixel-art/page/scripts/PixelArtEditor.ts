// Import Third-party Dependencies
import {
  registerConsoleFeatures,
  type RegistrationHandle
} from "@jolly-pixel/console";
import {
  PIXEL_ART_KIND,
  PixelCollaboration
} from "@jolly-pixel/asset.pixel-art/client";
import type {
  AssetLease,
  EditorContext,
  EditorSession
} from "@jolly-pixel/editor.host";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import { LocalStorageAdapter } from "@jolly-pixel/ui";
import {
  peerProfileColor,
  readUsername
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import {
  keybindConsole,
  KeyBindingSettings,
  type PixelDrawPanel
} from "../../src/index.ts";
import { PanelScope } from "../../src/panel/PanelScope.ts";
import {
  TEXTURE_DOCUMENT_KIND
} from "../../src/textures/textureDocumentKind.ts";
import { suggestTextureName } from "../../src/textures/textures.ts";

// CONSTANTS
const kZoom = {
  min: 1,
  max: 32
};

export interface PixelArtEditorParts {
  panel: PixelDrawPanel;
  scope: PanelScope;
  session: EditorSession;
  target: AssetLease<PixelDocument>;
  collaboration: PixelCollaboration;
  keybindings: () => void;
  consoleFeatures: RegistrationHandle;
}

export class PixelArtEditor {
  static readonly accepts = PIXEL_ART_KIND;
  static readonly identity = {
    title: "Join pixel art"
  };
  static readonly kinds = [TEXTURE_DOCUMENT_KIND];

  static async mount(
    context: EditorContext
  ): Promise<PixelArtEditor> {
    const { session, commands } = context;
    const panel = document.querySelector("pixel-draw-panel")!;
    const scope = new PanelScope(
      panel,
      document.querySelector("jolly-scope")!
    );
    await panel.updateComplete;

    const keyBindingSettings = new KeyBindingSettings({
      storage: new LocalStorageAdapter(),
      onDropped: (message) => console.warn(message)
    });
    panel.keyBindings = keyBindingSettings.keyBindings;

    const target = session.targetLease(TEXTURE_DOCUMENT_KIND);
    const { record } = target;
    const canvas = await panel.initialize({
      id: record.id,
      name: suggestTextureName(record.source),
      tooltip: record.source,
      document: target.document,
      defaultMode: "paint",
      zoom: kZoom,
      brush: {
        size: 1
      }
    });

    return new PixelArtEditor({
      panel,
      scope,
      session,
      target,
      collaboration: new PixelCollaboration({
        room: target.room,
        canvas,
        label: (_clientId, profile) => readUsername(profile),
        color: peerProfileColor
      }),
      keybindings: keyBindingSettings.subscribe("change", (keyBindings) => {
        panel.keyBindings = keyBindings;
      }),
      consoleFeatures: registerConsoleFeatures(
        commands,
        [keybindConsole],
        { keyBindingSettings }
      )
    });
  }

  readonly #scope: PanelScope;
  readonly #target: AssetLease<PixelDocument>;
  readonly #collaboration: PixelCollaboration;
  readonly #keybindings: () => void;
  readonly #consoleFeatures: RegistrationHandle;

  readonly ready: Promise<void>;
  readonly runtime = null;
  readonly panel: PixelDrawPanel;
  readonly session: EditorSession;

  constructor(
    parts: PixelArtEditorParts
  ) {
    this.panel = parts.panel;
    this.session = parts.session;
    this.#scope = parts.scope;
    this.#target = parts.target;
    this.#collaboration = parts.collaboration;
    this.#keybindings = parts.keybindings;
    this.#consoleFeatures = parts.consoleFeatures;
    this.ready = parts.target.ready;
  }

  dispose(): void {
    this.#consoleFeatures.unregister();
    this.#keybindings();
    this.#collaboration.destroy();
    this.#scope.dispose();
    this.#target.release();
    this.session.dispose();
  }
}
