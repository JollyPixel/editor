// Import Third-party Dependencies
import type { RegistrationHandle } from "@jolly-pixel/console";
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
  KeyBindingSettings,
  pixelArtConsole,
  type PixelDrawPanel
} from "../../src/index.ts";
import { PanelScope } from "../../src/panel/PanelScope.ts";
import {
  TEXTURE_DOCUMENT_KIND
} from "../../src/textures/textureDocumentKind.ts";
import { suggestTextureName } from "../../src/textures/textures.ts";
import type { PixelArtFeatures } from "./PixelArtFeatures.ts";
import { EditorPreferences } from "./EditorPreferences.ts";
import {
  TextureTabs,
  type TextureLease
} from "./TextureTabs.ts";
import type { PreviewPane } from "./preview/PreviewPane.ts";

// CONSTANTS
const kStorage = new LocalStorageAdapter();
const kColorDockedStorageKey = "pixel-art:color-docked";
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
  preferences: EditorPreferences;
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
    panel.colorDocked = kStorage.get(kColorDockedStorageKey) === "true";
    panel.allowUvCreateDelete = features.uvCreateDelete;
    panel.uvResize = features.uvResize;
    panel.textureImportPolicy = features.importPolicy;

    const previewType = loadPreview === null
      ? null
      : await loadPreview();
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
    const keybindings = keyBindingSettings.bind(panel);

    const target = session.targetLease(TEXTURE_DOCUMENT_KIND);
    const { record } = target;
    const preferences = new EditorPreferences(kStorage);
    const canvas = await panel.initialize({
      id: record.id,
      name: suggestTextureName(record.source),
      tooltip: record.source,
      document: target.document,
      defaultMode: preferences.mode,
      onModeChange: (mode) => {
        preferences.mode = mode;
      },
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
      preferences,
      keybindings,
      consoleFeatures: pixelArtConsole(commands, { keyBindingSettings })
    });
  }

  readonly #scope: PanelScope;
  readonly #keybindings: () => void;
  readonly #consoleFeatures: RegistrationHandle;
  readonly #preferences: EditorPreferences;

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
    this.#preferences = parts.preferences;
    this.#activatePreferences();
    this.panel.addEventListener("texture-change", this.#activatePreferences);
    this.panel.addEventListener(
      "color-docked-change",
      this.#saveColorDocked
    );
    this.runtime = parts.preview?.editorRuntime.runtime ?? null;
    this.ready = parts.target.ready;
  }

  dispose(): void {
    this.panel.removeEventListener("texture-change", this.#activatePreferences);
    this.#preferences.dispose();
    this.panel.removeEventListener(
      "color-docked-change",
      this.#saveColorDocked
    );
    this.#consoleFeatures.unregister();
    this.#keybindings();
    this.preview?.dispose();
    this.#scope.dispose();
    this.tabs.dispose();
    this.session.dispose();
  }

  readonly #saveColorDocked = (event: CustomEvent<boolean>): void => {
    kStorage.set(
      kColorDockedStorageKey,
      String(event.detail)
    );
  };

  readonly #activatePreferences = (): void => {
    const canvas = this.panel.canvasManager;
    if (canvas) {
      this.#preferences.activate(canvas);
    }
  };
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
