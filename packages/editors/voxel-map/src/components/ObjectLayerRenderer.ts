// Import Third-party Dependencies
import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import type {
  VoxelRenderer,
  VoxelObjectJSON,
  VoxelLayerHookEvent
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

export interface ObjectLayerRendererOptions {
  vr: VoxelRenderer;
  camera: THREE.PerspectiveCamera;
}

export class ObjectLayerRenderer extends ActorComponent {
  #vr: VoxelRenderer;
  #camera: THREE.PerspectiveCamera;

  #objectGroups: Map<string, THREE.Group> = new Map();

  #controls: TransformControls | null = null;
  #controlsHelper: THREE.Object3D | null = null;
  #selectedObjectKey: string | null = null;
  #initialObjDimensions: { w: number; h: number; } | null = null;
  #raycaster = new THREE.Raycaster();
  #isDragging = false;
  // Set to true when TransformControls "mouseDown" fires so the same click
  // that activates a handle does not immediately deselect the object.
  #skipNextSelect = false;

  constructor(
    actor: Actor,
    options: ObjectLayerRendererOptions
  ) {
    super({
      actor,
      typeName: "ObjectLayerRenderer"
    });
    this.#vr = options.vr;
    this.#camera = options.camera;
  }

  awake(): void {
    const canvas = this.actor.world.renderer.canvas;

    // --- TransformControls ---
    this.#controls = new TransformControls(this.#camera, canvas);
    this.#controls.setMode("translate");
    this.#controlsHelper = this.#controls.getHelper();
    this.actor.addChildren(this.#controlsHelper);

    // When the user presses down on a handle, mark that the next click
    // originating from the engine input system should be skipped for selection.
    this.#controls.addEventListener("mouseDown", () => {
      this.#skipNextSelect = true;
    });

    // Flush position / scale to VoxelObjectJSON once the drag ends.
    this.#controls.addEventListener("mouseUp", () => {
      this.#flushObjectTransform();
    });

    this.#controls.addEventListener("dragging-changed", (event) => {
      this.#isDragging = (event as THREE.Event & { value: boolean; }).value;
      editorState.setGizmoDragging(this.#isDragging);
    });

    // In scale mode snap X/Z to 1-unit steps and lock Y to 1 (objects are
    // always 1 unit tall). The scale is clamped per-frame so the visual
    // feedback during drag already shows the snapped result.
    this.#controls.addEventListener("objectChange", () => {
      if (this.#controls?.mode !== "scale") {
        return;
      }

      const group = this.#selectedObjectKey
        ? this.#objectGroups.get(this.#selectedObjectKey)
        : null;
      const dims = this.#initialObjDimensions;

      if (!group || !dims) {
        return;
      }

      const targetW = Math.max(1, Math.round(dims.w * group.scale.x));
      group.scale.x = targetW / dims.w;

      const targetH = Math.max(1, Math.round(dims.h * group.scale.z));
      group.scale.z = targetH / dims.h;

      group.scale.y = 1;
    });

    // Deselect when the user switches away from an object layer.
    editorState.addEventListener("selectedLayerTypeChange", () => {
      if (editorState.selectedLayerType !== "object") {
        this.#detachControls();
      }
    });

    this.#rebuildAll();

    editorState.addEventListener("layerUpdated", (event) => {
      const evt = (event as CustomEvent<VoxelLayerHookEvent>).detail;
      if (
        evt.action === "object-layer-added" ||
        evt.action === "object-layer-removed" ||
        evt.action === "object-layer-updated"
      ) {
        this.#rebuildAll();
      }
      else if (
        evt.action === "object-added" ||
        evt.action === "object-removed" ||
        evt.action === "object-updated"
      ) {
        this.#rebuildLayer(evt.layerName);
      }
    });
  }

  #rebuildAll(): void {
    this.#detachControls();
    for (const group of this.#objectGroups.values()) {
      this.#disposeGroup(group);
    }
    this.#objectGroups.clear();

    for (const layer of this.#vr.getObjectLayers()) {
      this.#rebuildLayer(layer.name);
    }
  }

  #rebuildLayer(
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

    // Re-attach controls after a rebuild triggered by vr.updateObject so the
    // gizmo tracks the freshly created group for the same selected object.
    if (
      this.#selectedObjectKey?.startsWith(`${layerName}:`) &&
      this.#controls
    ) {
      const newGroup = this.#objectGroups.get(this.#selectedObjectKey);
      if (newGroup) {
        const objId = this.#selectedObjectKey.slice(layerName.length + 1);
        const obj = layer.objects.find((o) => o.id === objId);
        if (obj) {
          this.#initialObjDimensions = { w: obj.width ?? 1, h: obj.height ?? 1 };
        }
        this.#controls.attach(newGroup);
      }
      else {
        this.#detachControls();
      }
    }
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
        color: 0x44aaff,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    group.add(fillMesh);

    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    const lines = new THREE.LineSegments(
      edgesGeo,
      new THREE.LineDashedMaterial({
        color: 0x88ccff,
        dashSize: 0.25,
        gapSize: 0.1
      })
    );
    lines.computeLineDistances();
    group.add(lines);

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

  #trySelectObject(): void {
    const { input } = this.actor.world;
    this.#raycaster.setFromCamera(input.getMousePosition(), this.#camera);

    const fillMeshes: THREE.Mesh[] = [];
    const meshToKey = new Map<THREE.Mesh, string>();
    for (const [key, group] of this.#objectGroups) {
      const firstChild = group.children[0];
      if (firstChild instanceof THREE.Mesh) {
        fillMeshes.push(firstChild);
        meshToKey.set(firstChild, key);
      }
    }

    const hits = this.#raycaster.intersectObjects(fillMeshes, false);
    if (hits.length > 0) {
      const key = meshToKey.get(hits[0].object as THREE.Mesh);
      if (key) {
        this.#selectObject(key);

        return;
      }
    }

    this.#detachControls();
  }

  #selectObject(
    key: string
  ): void {
    const colonIdx = key.lastIndexOf(":");
    const layerName = key.slice(0, colonIdx);
    const objId = key.slice(colonIdx + 1);

    const layer = this.#vr.getObjectLayer(layerName);
    const obj = layer?.objects.find((o) => o.id === objId);
    if (!obj) {
      return;
    }

    this.#selectedObjectKey = key;
    this.#initialObjDimensions = { w: obj.width ?? 1, h: obj.height ?? 1 };

    const group = this.#objectGroups.get(key)!;
    this.#controls?.attach(group);
  }

  #detachControls(): void {
    this.#controls?.detach();
    this.#selectedObjectKey = null;
    this.#initialObjDimensions = null;
  }

  #flushObjectTransform(): void {
    if (!this.#selectedObjectKey || !this.#controls) {
      return;
    }

    const colonIdx = this.#selectedObjectKey.lastIndexOf(":");
    const layerName = this.#selectedObjectKey.slice(0, colonIdx);
    const objId = this.#selectedObjectKey.slice(colonIdx + 1);

    const layer = this.#vr.getObjectLayer(layerName);
    const obj = layer?.objects.find((o) => o.id === objId);
    const group = this.#objectGroups.get(this.#selectedObjectKey);

    if (!obj || !group) {
      return;
    }

    if (this.#controls.mode === "translate") {
      const w = obj.width ?? 1;
      const h = obj.height ?? 1;
      this.#vr.updateObject(layerName, objId, {
        x: Math.round(group.position.x - w / 2),
        y: Math.round(group.position.y - 0.5),
        z: Math.round(group.position.z - h / 2)
      });
    }
    else if (this.#controls.mode === "scale") {
      // Scale is already snapped to integer steps by the objectChange handler,
      // so Math.round here is just a safety net.
      const dims = this.#initialObjDimensions!;
      this.#vr.updateObject(layerName, objId, {
        width: Math.max(1, Math.round(dims.w * group.scale.x)),
        height: Math.max(1, Math.round(dims.h * group.scale.z))
      });
    }
  }

  update(): void {
    if (editorState.selectedLayerType !== "object") {
      return;
    }

    const { input } = this.actor.world;

    // G = move (translate), S = scale — only when an object is selected.
    if (this.#selectedObjectKey && this.#controls) {
      if (input.wasKeyJustPressed("KeyG")) {
        this.#controls.setMode("translate");
      }
      else if (input.wasKeyJustPressed("KeyS")) {
        this.#controls.setMode("scale");
      }
    }

    // Handle object selection clicks (skip if a controls handle was just pressed).
    if (!this.#isDragging && input.wasMouseButtonJustPressed("left")) {
      if (this.#skipNextSelect) {
        this.#skipNextSelect = false;
      }
      else {
        this.#trySelectObject();
      }
    }
  }

  override destroy(): void {
    if (this.#controls) {
      this.#controls.detach();
      this.#controls.dispose();
      this.#controls = null;
    }

    for (const group of this.#objectGroups.values()) {
      this.#disposeGroup(group);
    }
    this.#objectGroups.clear();
    super.destroy();
  }
}
