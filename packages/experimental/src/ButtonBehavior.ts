// Import Third-party Dependencies
import * as THREE from "three";
import {
  Actor,
  Behavior,
  Signal,
  type SignalEvent
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import { CanvasTextRenderer } from "./CanvasTextRenderer.js";

export interface ButtonBehaviorOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  backgroundColor?: number;
  hoverColor?: number;
  textColor?: string;
  fontSize?: number;
}

export class ButtonBehavior extends Behavior {
  mesh: THREE.Mesh;

  #options: Required<ButtonBehaviorOptions>;
  #textRenderer: CanvasTextRenderer;
  #isHoverSprite = false;

  @Signal()
  onHover: SignalEvent;

  @Signal()
  onClick: SignalEvent;

  constructor(
    actor: Actor,
    options: ButtonBehaviorOptions
  ) {
    super(actor);

    this.#options = {
      backgroundColor: 0x3498db,
      hoverColor: 0x2980b9,
      textColor: "#ffffff",
      fontSize: 24,
      ...options
    };
  }

  awake() {
    this.#textRenderer = new CanvasTextRenderer({
      text: this.#options.text,
      backgroundColor: this.#options.backgroundColor,
      textColor: this.#options.textColor,
      fontSize: this.#options.fontSize
    });

    const geometry = new THREE.PlaneGeometry(
      this.#options.width,
      this.#options.height
    );

    const material = new THREE.MeshBasicMaterial({
      map: this.#textRenderer.texture,
      transparent: true,
      side: THREE.DoubleSide
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(
      this.#options.x,
      this.#options.y,
      0
    );

    this.#renderText();
    this.actor.threeObject.add(this.mesh);
  }

  #renderText(): void {
    const backgroundColor = this.#isHoverSprite
      ? this.#options.hoverColor
      : this.#options.backgroundColor;

    this.#textRenderer.render({ backgroundColor });
  }

  #isPointerOverSprite(): boolean {
    const mouse = this.actor.gameInstance.input.getMouseWorldPosition();

    const box = new THREE.Box3().setFromObject(this.mesh);

    return box.containsPoint(
      new THREE.Vector3(mouse.x, mouse.y, 0)
    );
  }

  update() {
    const { input } = this.actor.gameInstance;

    if (this.#isPointerOverSprite()) {
      if (!this.#isHoverSprite) {
        this.onHover.emit();
      }
      this.#isHoverSprite = true;

      if (input.wasMouseButtonJustReleased("left")) {
        this.onClick.emit();
      }
    }
    else {
      this.#isHoverSprite = false;
    }
    this.#renderText();
  }

  override destroy(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.#textRenderer.dispose();
  }
}
