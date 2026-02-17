// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  WorldDefaultContext
} from "../systems/World.ts";
import {
  Actor,
  SignalEvent
} from "../actor/index.ts";
import {
  UINode,
  type UINodeOptions
} from "./UINode.ts";
import {
  UIText,
  type UITextOptions
} from "./UIText.ts";

// CONSTANTS
const kDoubleClickThresholdMs = 300;

export interface UISpriteStyle {
  color?: THREE.ColorRepresentation;
  map?: THREE.Texture;
  opacity?: number;
}

export interface UISpriteOptions extends UINodeOptions {
  text?: UITextOptions;
  style?: UISpriteStyle;
  styleOnHover?: UISpriteStyle;
}

export class UISprite<
  TContext = WorldDefaultContext
> extends UINode<TContext> {
  mesh: THREE.Mesh;

  #isHovered = false;
  #isPressed = false;
  #style: UISpriteStyle;
  #styleOnHover: UISpriteStyle | null;
  #text: UIText<TContext> | undefined;

  #lastClickTime = 0;

  onPointerEnter = new SignalEvent();
  onPointerLeave = new SignalEvent();
  onPointerDown = new SignalEvent();
  onPointerUp = new SignalEvent();
  onClick = new SignalEvent();
  onDoubleClick = new SignalEvent();
  onRightClick = new SignalEvent();
  onHover = new SignalEvent();

  constructor(
    actor: Actor<TContext>,
    options: UISpriteOptions = {}
  ) {
    super(actor, options);

    this.#style = options.style ?? {};
    this.#styleOnHover = options.styleOnHover ?? null;

    if (options.text) {
      this.#text = new UIText(this, options.text);
    }
  }

  awake() {
    const { width, height } = this.size;
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({
      color: this.#style.color ?? 0xffffff,
      map: this.#style.map ?? null,
      opacity: this.#style.opacity ?? 1,
      transparent: true,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.addChildren(this.mesh);
  }

  #applyStyle(
    style: UISpriteStyle
  ): void {
    const material = this.mesh.material as THREE.MeshBasicMaterial;

    material.color.set(style.color ?? this.#style.color ?? 0xffffff);
    material.map = style.map ?? this.#style.map ?? null;
    material.opacity = style.opacity ?? this.#style.opacity ?? 1;
    material.needsUpdate = true;
  }

  isPointerOver(): boolean {
    const mouse = this.actor.world.input.getMouseWorldPosition();
    const box = new THREE.Box3().setFromObject(this.mesh);

    return box.containsPoint(
      new THREE.Vector3(mouse.x, mouse.y, 0)
    );
  }

  update() {
    const { input } = this.actor.world;
    const isOver = this.isPointerOver();

    // --- Pointer Enter / Leave ---
    if (isOver && !this.#isHovered) {
      this.#isHovered = true;
      this.onPointerEnter.emit();
      this.onHover.emit();

      if (this.#styleOnHover) {
        this.#applyStyle(this.#styleOnHover);
      }
    }
    else if (!isOver && this.#isHovered) {
      this.#isHovered = false;
      this.onPointerLeave.emit();
      this.#applyStyle(this.#style);
    }

    // --- Pointer Down ---
    if (isOver && input.wasMouseButtonJustPressed("left")) {
      this.#isPressed = true;
      this.onPointerDown.emit();
    }

    // --- Right Click ---
    if (isOver && input.wasMouseButtonJustReleased("right")) {
      this.onRightClick.emit();
    }

    // --- Pointer Up / Click / Double Click ---
    if (this.#isPressed && input.wasMouseButtonJustReleased("left")) {
      this.#isPressed = false;
      this.onPointerUp.emit();

      if (isOver) {
        this.onClick.emit();

        const now = performance.now();
        if (now - this.#lastClickTime < kDoubleClickThresholdMs) {
          this.onDoubleClick.emit();
          this.#lastClickTime = 0;
        }
        else {
          this.#lastClickTime = now;
        }
      }
    }
  }

  override destroy(): void {
    const material = this.mesh.material as THREE.MeshBasicMaterial;

    material.map?.dispose();
    material.dispose();
    this.mesh.geometry.dispose();

    this.#text?.destroy();
  }
}
