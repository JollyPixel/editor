// Import Third-party Dependencies
import type {
  CommandConsole,
  RegistrationHandle
} from "@jolly-pixel/console";
import { EditorRuntime } from "@jolly-pixel/editor.host";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import { LocalStorageAdapter } from "@jolly-pixel/ui";
import { css } from "lit";

// Import Internal Dependencies
import {
  CANVAS_HOVER_CHANGE_EVENT,
  type PixelDrawPanel
} from "../../../src/index.ts";
import { PixelPreviewScene } from "./PixelPreviewScene.ts";
import { previewConsole } from "./previewConsole.ts";

// CONSTANTS
const kStorage = new LocalStorageAdapter();
const kRotationStorageKey = "pixel-draw-demo:rotation";
const kStyles = css`
  jolly-pane {
    height: 100%;
  }

  jolly-pane::part(content) {
    padding: 0;
    overflow: hidden;
  }

  jolly-pane pixel-draw-panel {
    height: 100%;
    background-color: light-dark(#fff, #1a2228);
  }

  .preview-viewport {
    flex: 1;
    position: relative;
    overflow: hidden;
    min-width: 0;
  }

  .preview-viewport canvas {
    display: block;
    width: 100%;
    height: 100%;
    outline: none;
  }
`;

export interface PreviewPaneOptions {
  panel: PixelDrawPanel;
  canvasManager: PixelArtCanvas;
  commands: CommandConsole;
}

interface PreviewPaneParts {
  panel: PixelDrawPanel;
  commands: CommandConsole;
  editorRuntime: EditorRuntime;
  scene: PixelPreviewScene;
}

export class PreviewPane {
  static layout(
    panel: PixelDrawPanel
  ): void {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(kStyles.cssText);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

    const dock = document.createElement("jolly-dock");
    dock.setAttribute("side", "left");
    dock.setAttribute("size", "500");
    dock.setAttribute("min-size", "400");
    dock.setAttribute("max-size", "700");
    const pane = document.createElement("jolly-pane");
    dock.append(pane);

    const viewport = document.createElement("div");
    viewport.className = "preview-viewport";
    const canvas = document.createElement("canvas");
    canvas.tabIndex = -1;
    viewport.append(canvas);

    panel.replaceWith(dock, viewport);
    pane.append(panel);
  }

  static async open(
    options: PreviewPaneOptions
  ): Promise<PreviewPane> {
    const scene = new PixelPreviewScene({
      canvasManager: options.canvasManager,
      rotating: kStorage.get(kRotationStorageKey) !== "false"
    });
    const editorRuntime = await EditorRuntime.create(
      ".preview-viewport > canvas",
      {
        includePerformanceStats: false,
        focusCanvas: false,
        viewHelper: true
      }
    );
    await editorRuntime.load(scene);
    await scene.ready;

    return new PreviewPane({
      panel: options.panel,
      commands: options.commands,
      editorRuntime,
      scene
    });
  }

  readonly #panel: PixelDrawPanel;
  readonly #resumeKeyboard: () => void;
  readonly #console: RegistrationHandle;

  readonly editorRuntime: EditorRuntime;
  readonly scene: PixelPreviewScene;

  constructor(
    parts: PreviewPaneParts
  ) {
    this.#panel = parts.panel;
    this.editorRuntime = parts.editorRuntime;
    this.scene = parts.scene;

    this.#panel.addEventListener("theme-change", this.#applyTheme);
    this.#panel.addEventListener("texture-change", this.#followActiveTexture);
    this.#resumeKeyboard = this.editorRuntime.suspendKeyboardOnHover(
      this.#panel,
      CANVAS_HOVER_CHANGE_EVENT
    );
    this.#console = previewConsole(parts.commands, { preview: this });
    this.#applyTheme();
  }

  get rotating(): boolean {
    return this.scene.rotating;
  }

  set rotating(
    rotating: boolean
  ) {
    this.scene.rotating = rotating;
    kStorage.set(kRotationStorageKey, String(rotating));
  }

  dispose(): void {
    this.#console.unregister();
    this.#panel.removeEventListener("theme-change", this.#applyTheme);
    this.#panel.removeEventListener("texture-change", this.#followActiveTexture);
    this.#resumeKeyboard();
    this.scene.destroy();
  }

  readonly #applyTheme = (): void => {
    this.scene.setAppearance(this.#panel.resolvedTheme);
  };

  readonly #followActiveTexture = (): void => {
    const canvas = this.#panel.canvasManager;
    if (canvas !== null) {
      this.scene.setCanvas(canvas);
    }
  };
}
