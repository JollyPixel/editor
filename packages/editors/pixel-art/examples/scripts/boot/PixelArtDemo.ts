// Import Third-party Dependencies
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import type { ThemePreferences } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  PixelDrawPanel,
  TextureImportPolicy
} from "../../../src/index.ts";
import { suggestTextureName } from "../../../src/textures/textures.ts";
import { TEXTURE_SIZE } from "../config.ts";
import { DemoSession } from "./DemoSession.ts";
import { DemoShell } from "./DemoShell.ts";
import { DemoTextures } from "./DemoTextures.ts";
import {
  openDemoPreview,
  type DemoPreview
} from "./DemoPreview.ts";

// CONSTANTS
const kStarterRegionId = "pixel-draw-demo:starter-region";
const kStarterRegionSize = 16;

export interface PixelArtDemoOptions {
  asset: string;
  preview: boolean;
  starterRegion: boolean;
  importPolicy?: TextureImportPolicy;
  maxFps?: number;
  addDelay?: number;
}

export interface PixelArtDemoParts {
  panel: PixelDrawPanel;
  preview: DemoPreview | null;
  shell: DemoShell;
  session: DemoSession;
  textures: DemoTextures;
}

export class PixelArtDemo {
  static async open(
    options: PixelArtDemoOptions
  ): Promise<PixelArtDemo> {
    const panel = document.querySelector("pixel-draw-panel")!;
    if (options.importPolicy !== undefined) {
      panel.textureImportPolicy = options.importPolicy;
    }
    const themePreferences = document.querySelector<ThemePreferences>(
      "jolly-theme-preferences"
    )!;
    await panel.updateComplete;
    themePreferences.target = panel;
    await themePreferences.updateComplete;

    const canvas = await panel.initialize({
      texture: {
        size: TEXTURE_SIZE
      },
      defaultMode: "paint",
      zoom: {
        min: 1,
        max: 32
      },
      brush: {
        size: 1
      },
      history: {
        enabled: true
      }
    });
    const textureId = panel.activeTextureId!;
    const preview = options.preview ?
      await openDemoPreview({
        canvas: "#canvas-container > canvas",
        canvasManager: canvas,
        rotationToggle: document.querySelector<HTMLInputElement>("#rotation-toggle")!,
        maxFps: options.maxFps
      }) :
      null;
    const shell = new DemoShell(panel, preview);

    const session = await DemoSession.open(options.asset);
    const textures = new DemoTextures({
      panel,
      session,
      addDelay: options.addDelay ?? 0
    });
    panel.renameTexture(textureId, suggestTextureName(session.asset.source));
    await textures.bind(textureId, session.asset.id.value, canvas);
    if (options.starterRegion) {
      selectStarterRegion(canvas);
    }

    return new PixelArtDemo({
      panel,
      preview,
      shell,
      session,
      textures
    });
  }

  readonly #shell: DemoShell;

  readonly panel: PixelDrawPanel;
  readonly preview: DemoPreview | null;
  readonly session: DemoSession;
  readonly textures: DemoTextures;

  constructor(
    parts: PixelArtDemoParts
  ) {
    this.panel = parts.panel;
    this.preview = parts.preview;
    this.session = parts.session;
    this.textures = parts.textures;
    this.#shell = parts.shell;
  }

  dispose(): void {
    this.#shell.dispose();
    this.textures.dispose();
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
