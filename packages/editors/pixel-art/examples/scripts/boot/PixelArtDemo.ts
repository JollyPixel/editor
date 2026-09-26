// Import Third-party Dependencies
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import type { Runtime } from "@jolly-pixel/runtime";
import type { ThemePreferences } from "@jolly-pixel/ui";
import {
  PIXEL_ART_KIND,
  type SyncedPixelDocument
} from "@jolly-pixel/asset.pixel-art/client";
import {
  QueryParams,
  type EditorContext,
  type EditorSession
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import {
  isTextureImportPolicy,
  suggestTextureName
} from "../../../src/textures/textures.ts";
import type { PixelDrawPanel } from "../../../src/index.ts";
import { DemoShell } from "./DemoShell.ts";
import { TextureTabs } from "./TextureTabs.ts";
import { DEMO_TEXTURE_KIND } from "./textureKind.ts";
import { TEXTURE_SIZE } from "../config.ts";
import {
  openDemoPreview,
  type DemoPreview
} from "./DemoPreview.ts";

// CONSTANTS
const kStarterRegionId = "pixel-draw-demo:starter-region";
const kStarterRegionSize = 16;

export interface PixelArtDemoParams {
  runtime: string | undefined;
  empty: boolean;
  importPolicy: string | undefined;
  addDelay: number | undefined;
}

export const PIXEL_ART_DEMO_PARAMS = new QueryParams<PixelArtDemoParams>((query) => {
  return {
    runtime: query.string("runtime"),
    empty: query.flag("empty"),
    importPolicy: query.string("import-policy"),
    addDelay: query.number("add-delay")
  };
});

export interface PixelArtDemoParts {
  panel: PixelDrawPanel;
  preview: DemoPreview | null;
  shell: DemoShell;
  session: EditorSession;
  target: SyncedPixelDocument;
  tabs: TextureTabs;
}

export class PixelArtDemo {
  static readonly accepts = PIXEL_ART_KIND;
  static readonly identity = {
    title: "Join pixel-draw demo"
  };
  static readonly kinds = [];

  static async mount(
    context: EditorContext
  ): Promise<PixelArtDemo> {
    const { session } = context;
    const params = PIXEL_ART_DEMO_PARAMS.read();
    const panel = document.querySelector("pixel-draw-panel")!;
    if (params.importPolicy !== undefined && isTextureImportPolicy(params.importPolicy)) {
      panel.textureImportPolicy = params.importPolicy;
    }
    const themePreferences = document.querySelector<ThemePreferences>(
      "jolly-theme-preferences"
    )!;
    await panel.updateComplete;
    themePreferences.target = panel;
    await themePreferences.updateComplete;

    const { room, record } = session.target;
    const target = DEMO_TEXTURE_KIND.createDocument(room);
    target.document.buffer.resize(TEXTURE_SIZE);
    room.join();

    const canvas = await panel.initialize({
      id: record.id,
      name: suggestTextureName(record.source),
      tooltip: record.source,
      document: target.document,
      defaultMode: "paint",
      zoom: {
        min: 1,
        max: 32
      },
      brush: {
        size: 1
      }
    });
    const preview = params.runtime === "off" ?
      null :
      await openDemoPreview({
        canvas: "#canvas-container > canvas",
        canvasManager: canvas,
        rotationToggle: document.querySelector<HTMLInputElement>("#rotation-toggle")!
      });
    const shell = new DemoShell(panel, preview);

    const tabs = new TextureTabs({
      panel,
      session,
      addDelay: positive(params.addDelay) ?? 0
    });
    await tabs.attach(
      record.id,
      {
        room,
        ready: target.ready,
        release: () => target.dispose()
      },
      canvas
    );
    if (!params.empty) {
      selectStarterRegion(canvas);
    }

    return new PixelArtDemo({
      panel,
      preview,
      shell,
      session,
      target,
      tabs
    });
  }

  readonly #shell: DemoShell;

  readonly ready: Promise<void>;
  readonly runtime: Runtime | null;
  readonly panel: PixelDrawPanel;
  readonly preview: DemoPreview | null;
  readonly session: EditorSession;
  readonly target: SyncedPixelDocument;
  readonly tabs: TextureTabs;

  constructor(
    parts: PixelArtDemoParts
  ) {
    this.panel = parts.panel;
    this.preview = parts.preview;
    this.session = parts.session;
    this.target = parts.target;
    this.tabs = parts.tabs;
    this.#shell = parts.shell;
    this.runtime = parts.preview?.editorRuntime.runtime ?? null;
    this.ready = Promise.all([
      parts.target.ready,
      parts.preview?.scene.ready
    ]).then(() => undefined);
  }

  dispose(): void {
    this.#shell.dispose();
    this.tabs.dispose();
    this.session.dispose();
  }
}

function positive(
  value: number | undefined
): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ?
    value :
    undefined;
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
