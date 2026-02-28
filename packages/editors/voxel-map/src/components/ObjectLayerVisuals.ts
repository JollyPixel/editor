// Import Third-party Dependencies
import * as THREE from "three";
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import type {
  VoxelRenderer,
  VoxelObjectJSON
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { editorState } from "../EditorState.ts";

// CONSTANTS
const kLabelCanvasWidth = 256;
const kLabelCanvasHeight = 64;
const kLabelSpriteWidth = 2;
const kLabelSpriteHeight = 0.5;

function makeTextSprite(
  text: string
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = kLabelCanvasWidth;
  canvas.height = kLabelCanvasHeight;

  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.shadowColor = "#000";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "white";
  ctx.fillText(text, 8, 44);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
    transparent: true
  });

  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 10;
  sprite.scale.set(kLabelSpriteWidth, kLabelSpriteHeight, 1);

  return sprite;
}

function colorFromId(
  id: string
): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }

  return new THREE.Color().setHSL((hash % 360) / 360, 0.65, 0.55).getHex();
}

export interface ObjectLayerVisualsOptions {
  vr: VoxelRenderer;
}

export class ObjectLayerVisuals extends ActorComponent {
  #vr: VoxelRenderer;
  #objectGroups: Map<string, THREE.Group> = new Map();

  constructor(
    actor: Actor,
    options: ObjectLayerVisualsOptions
  ) {
    super({
      actor,
      typeName: "ObjectLayerVisuals"
    });
    this.#vr = options.vr;
  }

  awake(): void {
    this.rebuildAll();

    editorState.addEventListener("selectedLayerChange", () => this.#updateObjectVisibility());
    editorState.addEventListener("selectedLayerTypeChange", () => this.#updateObjectVisibility());
  }

  rebuildAll(): void {
    for (const group of this.#objectGroups.values()) {
      this.#disposeGroup(group);
    }
    this.#objectGroups.clear();

    for (const layer of this.#vr.getObjectLayers()) {
      this.rebuildLayer(layer.name);
    }
    this.#updateObjectVisibility();
  }

  rebuildLayer(
    layerName: string
  ): void {
    const keysToRemove = [...this.#objectGroups.keys()].filter(
      (k) => k.startsWith(`${layerName}:`)
    );
    for (const key of keysToRemove) {
      this.#disposeGroup(this.#objectGroups.get(key)!);
      this.#objectGroups.delete(key);
    }

    const layer = this.#vr.getObjectLayer(layerName);
    if (!layer || !layer.visible) {
      return;
    }

    for (const obj of layer.objects) {
      if (obj.visible) {
        this.#addObjectGroup(layerName, obj);
      }
    }

    this.#updateObjectVisibility();
  }

  getGroup(
    key: string
  ): THREE.Group | undefined {
    return this.#objectGroups.get(key);
  }

  getFillMeshes(): { key: string; mesh: THREE.Mesh; }[] {
    const result: { key: string; mesh: THREE.Mesh; }[] = [];

    for (const [key, group] of this.#objectGroups) {
      const firstChild = group.children[0];
      if (firstChild instanceof THREE.Mesh) {
        result.push({ key, mesh: firstChild });
      }
    }

    return result;
  }

  #addObjectGroup(
    layerName: string,
    obj: VoxelObjectJSON
  ): void {
    const w = obj.width ?? 1;
    const h = obj.height ?? 1;

    const group = new THREE.Group();
    group.position.set(obj.x + w / 2, obj.y + 0.5, obj.z + h / 2);

    const boxGeo = new THREE.BoxGeometry(w, 1, h);
    const fillMesh = new THREE.Mesh(
      boxGeo,
      new THREE.MeshBasicMaterial({
        color: colorFromId(obj.id),
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    group.add(fillMesh);

    const label = makeTextSprite(obj.name);
    // Sit the label just above the top face of the bounding box.
    label.position.set(0, 0.8, 0);
    group.add(label);

    this.actor.object3D.add(group);
    this.#objectGroups.set(`${layerName}:${obj.id}`, group);
  }

  #disposeGroup(
    group: THREE.Group
  ): void {
    this.actor.object3D.remove(group);
    group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        }
        else {
          (child.material as THREE.Material).dispose();
        }
      }
      else if (child instanceof THREE.Sprite) {
        const mat = child.material as THREE.SpriteMaterial;
        mat.map?.dispose();
        mat.dispose();
      }
    });
  }

  #updateObjectVisibility(): void {
    const isObjectMode = editorState.selectedLayerType === "object";

    for (const [key, group] of this.#objectGroups) {
      const layerName = key.slice(0, key.lastIndexOf(":"));
      group.visible = isObjectMode && layerName === editorState.selectedLayer;
    }
  }

  override destroy(): void {
    for (const group of this.#objectGroups.values()) {
      this.#disposeGroup(group);
    }
    this.#objectGroups.clear();

    super.destroy();
  }
}
