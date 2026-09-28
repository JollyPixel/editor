// Import Third-party Dependencies
import type { Vector3Like } from "three";

// Import Internal Dependencies
import { VoxelTemplate } from "./VoxelTemplate.ts";
import type { VoxelTemplatePatch } from "./types.ts";
import type { VoxelLayer } from "../VoxelLayer.ts";
import type { VoxelCoord } from "../types.ts";
import type { VoxelPatchCells } from "../editing/voxelPatch.ts";
import {
  VOXEL_ABSENT,
  voxelBlockId,
  voxelTransform
} from "../storage/packedVoxel.ts";
import {
  VoxelTransform,
  type VoxelTransformOptions
} from "../../geometry/VoxelTransform.ts";
import type { VoxelTemplateCommand } from "../../commands/types.ts";
import type { VoxelTemplateJSON } from "../../serialization/types.ts";
import {
  deserializeVoxelTemplate,
  serializeVoxelTemplate
} from "../../serialization/world.ts";

export interface VoxelTemplatesOptions {
  chunkSize: number;
  layer: (name: string) => VoxelLayer | undefined;
  dispatch: (command: VoxelTemplateCommand) => boolean;
  patch: (layerName: string, cells: VoxelPatchCells) => void;
}

export interface VoxelTemplateCaptureOptions {
  name: string;
  /**
   * @default a generated `template_<n>` id
   */
  id?: string;
  /**
   * World-space box; a voxel is captured when its cell lies in
   * `[min, max)` on every axis.
   * @default the whole layer
   */
  bounds?: {
    min: Vector3Like;
    max: Vector3Like;
  };
  /**
   * World-space cell that lands on the placement position.
   * @default the bottom center of the captured voxels
   */
  pivot?: VoxelCoord;
  properties?: Record<string, any>;
}

export interface VoxelTemplatePlaceOptions {
  layerName: string;
  /**
   * World-space cell the template pivot lands on.
   */
  position: VoxelCoord;
  /**
   * Turns and mirrors the template around its pivot.
   * @default VoxelTransform.Identity
   */
  transform?: VoxelTransformOptions;
  /**
   * Replaces voxels already in the layer; `false` fills empty cells only.
   * @default true
   */
  overwrite?: boolean;
}

/**
 * Templates saved with a world, keyed by id. Every change is dispatched to
 * the world as a template command; placing one is a voxel patch.
 */
export class VoxelTemplates implements Iterable<VoxelTemplate> {
  #templates = new Map<string, VoxelTemplate>();
  #chunkSize: number;
  #layer: (name: string) => VoxelLayer | undefined;
  #dispatch: (command: VoxelTemplateCommand) => boolean;
  #patch: (layerName: string, cells: VoxelPatchCells) => void;
  #idCounter = 0;

  constructor(
    options: VoxelTemplatesOptions
  ) {
    this.#chunkSize = options.chunkSize;
    this.#layer = options.layer;
    this.#dispatch = options.dispatch;
    this.#patch = options.patch;
  }

  get size(): number {
    return this.#templates.size;
  }

  [Symbol.iterator](): IterableIterator<VoxelTemplate> {
    return this.#templates.values();
  }

  toArray(): VoxelTemplate[] {
    return [...this.#templates.values()];
  }

  get(
    id: string
  ): VoxelTemplate | undefined {
    return this.#templates.get(id);
  }

  createFromLayer(
    layerName: string,
    options: VoxelTemplateCaptureOptions
  ): VoxelTemplate | undefined {
    const layer = this.#layer(layerName);
    if (layer === undefined) {
      return undefined;
    }

    const { bounds } = options;
    const { x: ox, y: oy, z: oz } = layer.position;
    const positions: number[] = [];
    const voxels: number[] = [];
    for (const [lx, ly, lz, packed] of layer.localVoxels()) {
      const x = lx + ox;
      const y = ly + oy;
      const z = lz + oz;
      if (bounds === undefined || (
        x >= bounds.min.x && x < bounds.max.x &&
        y >= bounds.min.y && y < bounds.max.y &&
        z >= bounds.min.z && z < bounds.max.z
      )) {
        positions.push(x, y, z);
        voxels.push(packed);
      }
    }
    if (voxels.length === 0) {
      return undefined;
    }

    const template = new VoxelTemplate({
      id: options.id ?? this.#nextId(),
      name: options.name,
      pivot: options.pivot,
      properties: options.properties,
      positions,
      voxels
    });
    this.define(serializeVoxelTemplate(template, this.#chunkSize));

    return this.#templates.get(template.id);
  }

  /**
   * Adds the template, or replaces the one with the same id.
   *
   * @throws {InvalidVoxelWorldError} when `template` is malformed
   */
  define(
    template: VoxelTemplateJSON
  ): boolean {
    return this.#dispatch({
      action: "template-defined",
      template
    });
  }

  update(
    id: string,
    patch: VoxelTemplatePatch
  ): boolean {
    return this.#dispatch({
      action: "template-updated",
      templateId: id,
      patch
    });
  }

  transform(
    id: string,
    transform: VoxelTransformOptions
  ): boolean {
    const template = this.#templates.get(id);
    const resolved = VoxelTransform.fromPacked(VoxelTransform.pack(transform));
    if (template === undefined || resolved.equals(VoxelTransform.Identity)) {
      return false;
    }

    return this.define(
      serializeVoxelTemplate(template.transformed(resolved), this.#chunkSize)
    );
  }

  remove(
    id: string
  ): boolean {
    return this.#dispatch({
      action: "template-removed",
      templateId: id
    });
  }

  place(
    id: string,
    options: VoxelTemplatePlaceOptions
  ): boolean {
    const {
      layerName,
      position,
      transform,
      overwrite = true
    } = options;
    const template = this.#templates.get(id);
    const layer = this.#layer(layerName);
    if (template === undefined || layer === undefined) {
      return false;
    }

    const cells: VoxelPatchCells = [];
    const placed = template.placedVoxels(
      position,
      VoxelTransform.fromPacked(VoxelTransform.pack(transform))
    );
    for (const [x, y, z, packed] of placed) {
      if (
        overwrite ||
        layer.getPackedVoxelAt({ x, y, z }) === VOXEL_ABSENT
      ) {
        cells.push(x, y, z, voxelBlockId(packed), voxelTransform(packed));
      }
    }
    if (cells.length === 0) {
      return false;
    }
    this.#patch(layerName, cells);

    return true;
  }

  countBlocks(): Map<number, number> {
    const counts = new Map<number, number>();
    for (const template of this.#templates.values()) {
      for (const [blockId, count] of template.countBlocks()) {
        counts.set(blockId, (counts.get(blockId) ?? 0) + count);
      }
    }

    return counts;
  }

  apply(
    command: VoxelTemplateCommand
  ): VoxelTemplateCommand | null {
    switch (command.action) {
      case "template-defined": {
        const template = deserializeVoxelTemplate(command.template);
        this.#templates.set(template.id, template);

        return command;
      }
      case "template-updated": {
        const template = this.#templates.get(command.templateId);
        if (template === undefined) {
          return null;
        }
        this.#templates.set(template.id, template.withPatch(command.patch));

        return command;
      }
      case "template-removed":
        return this.#templates.delete(command.templateId) ? command : null;
      default: {
        const unhandled: never = command;
        throw new Error(
          `VoxelTemplates: unhandled action '${(unhandled as VoxelTemplateCommand).action}'.`
        );
      }
    }
  }

  restore(
    templates: Iterable<VoxelTemplate>
  ): void {
    this.#templates.clear();
    for (const template of templates) {
      this.#templates.set(template.id, template);
    }
  }

  clear(): void {
    this.#templates.clear();
  }

  #nextId(): string {
    let id: string;
    do {
      id = `template_${this.#idCounter++}`;
    } while (this.#templates.has(id));

    return id;
  }
}
