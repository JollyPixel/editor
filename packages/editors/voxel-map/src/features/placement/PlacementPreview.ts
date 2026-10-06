// Import Third-party Dependencies
import * as THREE from "three";
import { MarqueeBox } from "@jolly-pixel/three";
import type {
  BlockRegistry,
  VoxelTemplate
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BlockRenderSources } from "../blocks/rendering/BlockRenderSources.ts";
import type { CellRegion } from "./CellRegion.ts";
import type { Placement } from "./Placement.ts";
import { TemplateGhost } from "./TemplateGhost.ts";

// CONSTANTS
const kMarqueeShade = "#1a1a1a";

export interface PlacementPreviewOptions {
  sources: BlockRenderSources;
  blockRegistry: BlockRegistry;
  color: THREE.ColorRepresentation;
  opacity?: number;
}

export class PlacementPreview extends THREE.Group {
  readonly marquee: MarqueeBox;

  #ghost: TemplateGhost;
  #disposed = false;

  constructor(
    options: PlacementPreviewOptions
  ) {
    super();

    this.name = "placement-preview";
    this.marquee = new MarqueeBox({
      colors: [options.color, kMarqueeShade],
      xray: true
    });
    this.#ghost = new TemplateGhost({
      blockRegistry: options.blockRegistry,
      sources: options.sources,
      opacity: options.opacity
    });
    this.add(this.marquee, this.#ghost);
    this.visible = false;
  }

  draw(
    placement: Placement,
    template: VoxelTemplate
  ): void {
    const { position, transform } = placement;
    const bounds = placement.boundsIn(template);
    this.marquee.position.set(
      bounds.min.x,
      bounds.min.y,
      bounds.min.z
    );
    this.marquee.size = bounds.size;
    this.#ghost.position.set(
      position.x,
      position.y,
      position.z
    );
    this.#ghost.draw(template, transform);
    this.visible = true;
  }

  outline(
    region: CellRegion
  ): void {
    const { min } = region;
    this.marquee.position.set(min.x, min.y, min.z);
    this.marquee.size = region.size;
    this.#ghost.hide();
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
    this.#ghost.hide();
  }

  invalidate(): void {
    this.#ghost.invalidate();
  }

  override dispose(): void {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#ghost.dispose();
    this.marquee.dispose();
    this.clear();
    super.dispose();
  }
}
