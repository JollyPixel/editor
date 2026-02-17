// Import Third-party Dependencies
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

// Import Internal Dependencies
import type { GameInstanceDefaultContext } from "../systems/GameInstance.ts";
import type { UINode } from "./UINode.ts";

export interface UITextStyle {
  color?: string;
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: string;
  lineHeight?: string;
  letterSpacing?: string;
  textTransform?: string;
  whiteSpace?: string;
  textShadow?: string;
  padding?: string;
  backgroundColor?: string;
  borderRadius?: string;
  opacity?: string;
}

export interface UITextOptions {
  textContent?: string;
  style?: UITextStyle;
  /**
   * Z offset to place the text in front of the UINode.
   * @default 0.1
   */
  zOffset?: number;
}

// CONSTANTS
const kDefaultStyle: UITextStyle = {
  color: "#ffffff",
  fontSize: "14px",
  fontFamily: "Arial, sans-serif",
  whiteSpace: "nowrap"
};
const kDefaultZOffset = 0.1;

export class UIText<TContext = GameInstanceDefaultContext> {
  #element: HTMLDivElement;
  #cssObject: CSS2DObject;
  #style: UITextStyle;
  #node: UINode<TContext>;

  constructor(
    node: UINode<TContext>,
    options: UITextOptions = {}
  ) {
    this.#node = node;
    this.#style = { ...kDefaultStyle, ...options.style };

    this.#element = document.createElement("div");
    this.#element.textContent = options.textContent ?? "";

    this.#applyStyle(this.#style);

    this.#cssObject = new CSS2DObject(this.#element);
    this.#cssObject.position.z = options.zOffset ?? kDefaultZOffset;

    this.#node.addChildren(this.#cssObject);
  }

  get node(): UINode<TContext> {
    return this.#node;
  }

  get element(): HTMLDivElement {
    return this.#element;
  }

  get text(): string {
    return this.#element.textContent ?? "";
  }

  set text(value: string) {
    this.#element.textContent = value;
  }

  setStyle(style: Partial<UITextStyle>): void {
    Object.assign(this.#style, style);
    this.#applyStyle(this.#style);
  }

  #applyStyle(style: UITextStyle): void {
    for (const [key, value] of Object.entries(style)) {
      if (value !== undefined) {
        this.#element.style[key as keyof CSSStyleDeclaration as string] = value;
      }
    }
  }

  destroy(): void {
    this.#element.remove();
  }
}
