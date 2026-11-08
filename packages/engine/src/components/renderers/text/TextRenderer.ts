// Import Third-party Dependencies
import type { AssetReference } from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

// Import Internal Dependencies
import { ActorComponent } from "../../../actor/ActorComponent.ts";
import type { Actor } from "../../../actor/Actor.ts";
import type { WorldDefaultContext } from "../../../systems/World.ts";
import type { Font } from "../../../assets/font.ts";
import {
  MESH_SURFACE_DEFAULTS,
  mergeMeshSurface,
  type MeshSurfaceOptions,
  type MeshSurfaceSettings
} from "../mesh/MeshSurface.ts";
import { SurfaceMesh } from "../mesh/SurfaceMesh.ts";

export type TextAlign = "left" | "center" | "right";

export interface TextShapeOptions {
  /**
   * Line breaks (`\n`) start a new line.
   * @default ""
   */
  text?: string;
  /**
   * Height of a capital letter, in world units.
   * @default 1
   */
  size?: number;
  /**
   * Extrusion along the local Z axis, in world units.
   * @default 0.2
   */
  depth?: number;
  /**
   * @default 12
   */
  curveSegments?: number;
  /**
   * @default false
   */
  bevel?: boolean;
  /**
   * @default 0.05
   */
  bevelThickness?: number;
  /**
   * @default 0.02
   */
  bevelSize?: number;
  /**
   * Horizontal placement of the text around the actor origin.
   * @default "center"
   */
  align?: TextAlign;
}

export type TextFontSource =
  | {
    /**
     * Font resolved from the world's asset coordinator when the actor awakes.
     */
    asset: AssetReference<Font>;
    font?: never;
  }
  | {
    /**
     * Draws nothing while `null`.
     * @default null
     */
    font?: Font | null;
    asset?: never;
  };

export type TextRendererOptions =
  & TextShapeOptions
  & MeshSurfaceOptions
  & TextFontSource;

export type TextShape = Required<TextShapeOptions>;

export type TextSettings = TextShape & MeshSurfaceSettings;

type TextSettingsOptions = TextShapeOptions & MeshSurfaceOptions;

// CONSTANTS
export const TEXT_RENDERER_DEFAULTS = {
  ...MESH_SURFACE_DEFAULTS,
  text: "",
  size: 1,
  depth: 0.2,
  curveSegments: 12,
  bevel: false,
  bevelThickness: 0.05,
  bevelSize: 0.02,
  align: "center"
} as const satisfies TextSettings;

const kShapeKeys: Record<keyof TextShape, true> = {
  text: true,
  size: true,
  depth: true,
  curveSegments: true,
  bevel: true,
  bevelThickness: true,
  bevelSize: true,
  align: true
};

export class TextRenderer<
  TContext = WorldDefaultContext
> extends ActorComponent<TContext> {
  #asset: AssetReference<Font> | null;
  #font: Font | null;
  #settings: TextSettings;
  #surface: SurfaceMesh<THREE.MeshStandardMaterial>;

  constructor(
    actor: Actor<TContext>,
    options: TextRendererOptions = {}
  ) {
    super({
      actor,
      typeName: "TextRenderer"
    });

    const { asset = null, font = null, ...settings } = options;
    this.#asset = asset;
    this.#font = font;
    this.#settings = mergeSettings(TEXT_RENDERER_DEFAULTS, settings);
    this.#surface = SurfaceMesh.standard(
      actor.object3D,
      this.#createGeometry(),
      this.#settings
    );
    this.addTeardown(() => this.#surface.dispose());
  }

  awake(): void {
    if (this.#asset !== null) {
      this.font = this.getAsset(this.#asset);
    }
  }

  get threeMesh(): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
    return this.#surface.mesh;
  }

  get settings(): Readonly<TextSettings> {
    return this.#settings;
  }

  get font(): Font | null {
    return this.#font;
  }

  set font(
    font: Font | null
  ) {
    if (font !== this.#font) {
      this.#font = font;
      this.#surface.replaceGeometry(this.#createGeometry());
    }
  }

  configure(
    options: TextSettingsOptions
  ): this {
    const previous = this.#settings;
    this.#settings = mergeSettings(previous, options);

    if (!isSameShape(this.#settings, previous)) {
      this.#surface.replaceGeometry(this.#createGeometry());
    }
    this.#surface.configure(this.#settings);

    return this;
  }

  #createGeometry(): THREE.BufferGeometry {
    const settings = this.#settings;
    if (this.#font === null || settings.text.trim() === "") {
      return new THREE.BufferGeometry();
    }

    const geometry = new TextGeometry(settings.text, {
      font: this.#font,
      size: settings.size,
      depth: settings.depth,
      curveSegments: settings.curveSegments,
      bevelEnabled: settings.bevel,
      bevelThickness: settings.bevelThickness,
      bevelSize: settings.bevelSize
    });
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox!;
    geometry.translate(
      alignOffset(settings.align, min.x, max.x),
      0,
      -(min.z + max.z) / 2
    );

    return geometry;
  }
}

function alignOffset(
  align: TextAlign,
  minX: number,
  maxX: number
): number {
  switch (align) {
    case "left":
      return -minX;
    case "center":
      return -(minX + maxX) / 2;
    case "right":
      return -maxX;
  }
}

function isSameShape(
  left: TextShape,
  right: TextShape
): boolean {
  return (Object.keys(kShapeKeys) as (keyof TextShape)[])
    .every((key) => left[key] === right[key]);
}

function mergeSettings(
  settings: TextSettings,
  options: TextSettingsOptions
): TextSettings {
  return {
    ...mergeMeshSurface(settings, options),
    text: options.text ?? settings.text,
    size: options.size ?? settings.size,
    depth: options.depth ?? settings.depth,
    curveSegments: options.curveSegments ?? settings.curveSegments,
    bevel: options.bevel ?? settings.bevel,
    bevelThickness: options.bevelThickness ?? settings.bevelThickness,
    bevelSize: options.bevelSize ?? settings.bevelSize,
    align: options.align ?? settings.align
  };
}
