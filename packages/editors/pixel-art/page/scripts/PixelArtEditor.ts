// Import Third-party Dependencies
import {
  registerConsoleFeatures,
  type RegistrationHandle
} from "@jolly-pixel/console";
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art/client";
import type {
  EditorContext,
  EditorSession,
  PageEditorDefinition
} from "@jolly-pixel/editor.host";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import type { Runtime } from "@jolly-pixel/runtime";
import { LocalStorageAdapter } from "@jolly-pixel/ui";

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
import type { PixelArtFeatures } from "./PixelArtFeatures.ts";
import {
  TextureTabs,
  type TextureLease
} from "./TextureTabs.ts";
import type { PreviewPane } from "./preview/PreviewPane.ts";

// CONSTANTS
const kZoom = {
  min: 1,
  max: 32
};
const kStarterRegionId = "pixel-draw-demo:starter-region";
const kStarterRegionSize = 16;

export type PreviewPaneLoader = () => Promise<typeof PreviewPane>;

export interface PixelArtEditorOptions {
  features: PixelArtFeatures;
  loadPreview: PreviewPaneLoader | null;
}

export interface PixelArtEditorParts {
  panel: PixelDrawPanel;
  scope: PanelScope;
  preview: PreviewPane | null;
  session: EditorSession;
  target: TextureLease;
  tabs: TextureTabs;
  keybindings: () => void;
  consoleFeatures: RegistrationHandle;
}

export class PixelArtEditor {
  static definition(
    options: PixelArtEditorOptions
  ): PageEditorDefinition<PixelArtEditor> {
    return {
      accepts: PIXEL_ART_KIND,
      identity: {
        title: "Join pixel art"
      },
      kinds: [TEXTURE_DOCUMENT_KIND],
      mount: (context) => PixelArtEditor.mount(context, options)
    };
  }

  static async mount(
    context: EditorContext,
    options: PixelArtEditorOptions
  ): Promise<PixelArtEditor> {
    const { features, loadPreview } = options;
    const { session, commands } = context;
    const panel = document.querySelector("pixel-draw-panel")!;
    panel.allowUvCreateDelete = features.uvCreateDelete;
    panel.textureImportPolicy = features.importPolicy;
    const previewType = loadPreview === null ? null : await loadPreview();
    previewType?.layout(panel);
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
    const preview = previewType === null ?
      null :
      await previewType.open({
        panel,
        canvasManager: canvas,
        commands
      });

    const tabs = new TextureTabs({
      panel,
      session,
      addDelay: features.addDelay
    });
    await tabs.attach(target, canvas);
    if (features.starterRegion) {
      selectStarterRegion(canvas);
    }

    return new PixelArtEditor({
      panel,
      scope,
      preview,
      session,
      target,
      tabs,
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
  readonly #keybindings: () => void;
  readonly #consoleFeatures: RegistrationHandle;

  readonly ready: Promise<void>;
  readonly runtime: Runtime | null;
  readonly panel: PixelDrawPanel;
  readonly preview: PreviewPane | null;
  readonly session: EditorSession;
  readonly tabs: TextureTabs;

  constructor(
    parts: PixelArtEditorParts
  ) {
    this.panel = parts.panel;
    this.preview = parts.preview;
    this.session = parts.session;
    this.tabs = parts.tabs;
    this.#scope = parts.scope;
    this.#keybindings = parts.keybindings;
    this.#consoleFeatures = parts.consoleFeatures;
    this.runtime = parts.preview?.editorRuntime.runtime ?? null;
    this.ready = parts.target.ready;
  }

  dispose(): void {
    this.#consoleFeatures.unregister();
    this.#keybindings();
    this.preview?.dispose();
    this.#scope.dispose();
    this.tabs.dispose();
    this.session.dispose();
  }
}

function selectStarterRegion(
  canvas: PixelArtCanvas
): void {
  const [existingRegion] = canvas.uv.regions;
  const region = existingRegion ?? canvas.uv.create({
    id: kStarterRegionId,
    name: "cube 0",
    width: kStarterRegionSize,
    height: kStarterRegionSize
  });
  canvas.uv.select(region.id);
}
