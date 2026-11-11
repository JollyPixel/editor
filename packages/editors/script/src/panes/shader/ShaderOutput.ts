// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  readDetail,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button-group";

// Import Internal Dependencies
import {
  CODE_TOKEN_COLORS,
  tokenSpan
} from "../../syntax/tokens.ts";
import { highlight } from "../../syntax/highlight.ts";

export type ShaderStage = "fragment" | "vertex";

export type ShaderOutputState =
  | { kind: "compiling"; }
  | { kind: "built"; fragment: string; vertex: string; }
  | { kind: "failed"; message: string; };

// CONSTANTS
const kStages: JollyOption<ShaderStage>[] = [
  {
    value: "fragment",
    label: "Fragment"
  },
  {
    value: "vertex",
    label: "Vertex"
  }
];

export class ShaderOutput extends LitElement {
  static override properties = {
    state: { attribute: false },
    stage: { state: true }
  };

  static override styles = [CODE_TOKEN_COLORS, css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      color: var(--code-foreground);
      background: var(--jolly-surface-sunken);
    }

    header {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-2);
      padding: var(--jolly-space-2) var(--jolly-space-3);
      border-block-end: 1px solid var(--jolly-border);
      color: var(--jolly-text-muted);
      font-family: var(--jolly-font-family);
    }

    header span {
      margin-inline-start: auto;
    }

    pre {
      flex: 1;
      overflow: auto;
      margin: 0;
      padding: var(--jolly-space-2) var(--jolly-space-3);
      font-family: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace;
      font-size: 12px;
      line-height: 18px;
      tab-size: 2;
    }

    .error {
      color: var(--jolly-danger);
      white-space: pre-wrap;
    }
  `];

  declare state: ShaderOutputState;
  declare stage: ShaderStage;

  constructor() {
    super();
    this.state = { kind: "compiling" };
    this.stage = "fragment";
  }

  #onStage = (
    event: Event
  ): void => {
    const detail = readDetail<JollyChangeDetail<ShaderStage>>(event);
    if (detail !== null) {
      this.stage = detail.value;
    }
  };

  override render(): TemplateResult {
    const { state } = this;

    return html`
      <header>
        <jolly-button-group
          label="Shader stage"
          .options=${kStages}
          .value=${this.stage}
          ?disabled=${state.kind !== "built"}
          @jolly-change=${this.#onStage}
        ></jolly-button-group>
        <span>WGSL</span>
      </header>
      ${this.#renderBody()}
    `;
  }

  #renderBody(): TemplateResult | typeof nothing {
    const { state } = this;
    if (state.kind === "compiling") {
      return nothing;
    }
    if (state.kind === "failed") {
      return html`<pre class="error" role="alert">${state.message}</pre>`;
    }

    const wgsl = this.stage === "fragment" ? state.fragment : state.vertex;

    return html`<pre>${highlight(wgsl, "wgsl")
      .map((line) => html`${line.tokens.map(tokenSpan)}\n`)}</pre>`;
  }
}

customElements.define("jolly-shader-output", ShaderOutput);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-shader-output": ShaderOutput;
  }
}
