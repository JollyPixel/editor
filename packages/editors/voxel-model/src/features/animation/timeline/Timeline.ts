// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { frameToTick } from "@jolly-pixel/asset.voxel-animation/client";
import type { ContextMenu } from "@jolly-pixel/ui";

// Import Internal Dependencies
import "./timelineIcons.ts";
import {
  TimelineController,
  type TimelineView,
  type TimelineWorkspace
} from "./TimelineController.ts";
import type {
  TimelineKey,
  TimelineRow,
  UnboundTimelineRow
} from "./timelineRows.ts";
import { keyId } from "./timelineKeys.ts";
import { TRACK_STATE_LABELS } from "../trackBindingRows.ts";
import { ContextMenuController } from "../../../shared/ContextMenuController.ts";
import {
  EMPTY_MENU,
  menuPointBelow
} from "../../../shared/menuSession.ts";

// CONSTANTS
const kRulerSteps = [1, 2, 5, 10, 12, 24, 30, 60, 120, 240];
const kWidestRulerStep = 600;
const kMaxRulerLabels = 12;

type TimelineKeyAction = (controller: TimelineController) => void;

const kPlainKeys: Readonly<Record<string, TimelineKeyAction>> = {
  " ": (controller) => controller.session?.togglePlay(),
  ArrowLeft: (controller) => controller.session?.stepFrames(-1),
  ArrowRight: (controller) => controller.session?.stepFrames(1),
  Home: (controller) => controller.session?.seekEdge("start"),
  End: (controller) => controller.session?.seekEdge("end"),
  Delete: (controller) => controller.keys?.remove(),
  Backspace: (controller) => controller.keys?.remove()
};

const kCommandKeys: Readonly<Record<string, TimelineKeyAction>> = {
  c: (controller) => controller.keys?.copy(),
  v: (controller) => controller.keys?.paste()
};

interface KeyDrag {
  pointerId: number;
  startX: number;
  framesPerPixel: number;
  frames: number;
}

export class Timeline extends LitElement {
  static override styles = css`
    :host {
      --timeline-label-width: 160px;

      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      user-select: none;
    }

    .rows {
      flex: 1 1 auto;
      overflow: auto;
    }

    .row {
      display: flex;
      min-height: var(--jolly-row-height, 20px);
    }

    .label {
      box-sizing: border-box;
      flex: 0 0 var(--timeline-label-width);
      overflow: hidden;
      padding-inline: var(--jolly-space-2, 8px);
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      text-overflow: ellipsis;
      white-space: nowrap;
      cursor: pointer;
    }

    .row[data-selected="true"] .label {
      background: var(--jolly-selection-bg, rgb(47 111 216 / 25%));
    }

    .lane {
      position: relative;
      flex: 1 1 auto;
      margin-inline-end: var(--jolly-space-2, 8px);
      border-bottom: 1px solid var(--jolly-border, rgb(128 128 128 / 15%));
    }

    .ruler {
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--jolly-surface, #1e1f22);
    }

    .ruler .lane {
      height: 20px;
      cursor: ew-resize;
      touch-action: none;
    }

    .mark {
      position: absolute;
      top: 0;
      bottom: 0;
      border-left: 1px solid var(--jolly-border, rgb(128 128 128 / 40%));
      padding-inline-start: 2px;
      font-size: 0.85em;
      color: var(--jolly-text-muted, inherit);
      pointer-events: none;
    }

    .mark[data-end="true"] {
      padding-inline: 0 2px;
      border-left: 0;
      border-right: 1px solid var(--jolly-border, rgb(128 128 128 / 40%));
      transform: translateX(-100%);
    }

    .rows:focus-visible {
      outline: 1px solid var(--jolly-accent, #ffad72);
      outline-offset: -1px;
    }

    .key {
      position: absolute;
      top: 50%;
      width: 8px;
      height: 8px;
      background: var(--jolly-accent, #ffad72);
      transform: translate(-50%, -50%) rotate(45deg);
      cursor: ew-resize;
      touch-action: none;
    }

    .key[data-interpolation="step"] {
      transform: translate(-50%, -50%);
    }

    .key[data-interpolation="smooth"] {
      border-radius: 50%;
    }

    .key[data-selected="true"] {
      background: var(--jolly-text, white);
      outline: 2px solid var(--jolly-accent, #ffad72);
    }

    .playhead {
      position: absolute;
      top: 0;
      bottom: 0;
      left: var(--timeline-playhead, 0%);
      width: 0;
      border-left: 2px solid var(--jolly-danger, #e5484d);
      pointer-events: none;
    }

    :host([data-playhead-past-end]) .playhead {
      display: none;
    }

    .unbound {
      opacity: 0.55;
    }

    .unbound .label {
      color: var(--jolly-danger, #e5484d);
    }

    .unbound[data-state="ignored"] .label {
      color: var(--jolly-text-muted, inherit);
    }

    .unbound .key {
      cursor: default;
    }

    .unbound jolly-icon {
      vertical-align: middle;
    }

    .empty {
      padding: var(--jolly-space-2, 8px);
      color: var(--jolly-text-muted, inherit);
    }
  `;

  #controller = new TimelineController(this, {
    showPlayhead: (fraction) => {
      this.toggleAttribute("data-playhead-past-end", fraction === null);
      this.style.setProperty("--timeline-playhead", `${(fraction ?? 0) * 100}%`);
    }
  });
  #drag: KeyDrag | null = null;
  #menu = new ContextMenuController(
    () => this.renderRoot.querySelector<ContextMenu>("jolly-context-menu")!,
    () => EMPTY_MENU
  );

  attach(
    workspace: TimelineWorkspace
  ): void {
    this.#controller.attach(workspace);
  }

  override render(): TemplateResult {
    const { view } = this.#controller;
    if (view === null) {
      return html`<p class="empty">Pick or create a clip in the Animate panel to see its timeline.</p>`;
    }

    return html`
      <div
        class="rows"
        role="grid"
        aria-label="Timeline"
        tabindex="0"
        @keydown=${this.#onKeyDown}
      >
        ${this.#renderRuler(view)}
        ${view.rows.length === 0 ?
          html`<p class="empty">Select a block to animate it.</p>` :
          view.rows.map((row) => this.#renderRow(row, view))}
        ${view.unbound.map((row) => this.#renderUnboundRow(row, view))}
      </div>
      <jolly-context-menu
        label="Timeline"
        @jolly-context-action=${this.#menu.onContextAction}
      ></jolly-context-menu>
    `;
  }

  #renderUnboundRow(
    row: UnboundTimelineRow,
    view: TimelineView
  ): TemplateResult {
    const state = TRACK_STATE_LABELS[row.state];

    return html`
      <div class="row unbound" role="row" data-track=${row.path} data-state=${row.state}>
        <button
          class="label"
          type="button"
          title="${row.path}: ${state}. Rebind…"
          aria-label="Rebind ${row.path}"
          @click=${(event: MouseEvent) => this.#menu.open(
            this.#controller.rebindMenu(row.path),
            menuPointBelow(event)
          )}
        ><jolly-icon name="warning"></jolly-icon> ${row.name}</button>
        <div class="lane">
          ${row.keys.map(({ tick, interpolation }) => html`
            <span
              class="key"
              data-tick=${tick}
              data-interpolation=${interpolation}
              style="left: ${percent(tick, view.clip.length)}"
            ></span>
          `)}
          <span class="playhead"></span>
        </div>
      </div>
    `;
  }

  #renderRuler(
    view: TimelineView
  ): TemplateResult {
    const step = rulerStep(view.frames);
    const marks = Array.from(
      { length: Math.floor(view.frames / step) + 1 },
      (_, index) => index * step
    );

    return html`
      <div class="row ruler">
        <span class="label" aria-hidden="true"></span>
        <div
          class="lane"
          aria-label="Scrub"
          @pointerdown=${this.#onScrubStart}
          @pointermove=${this.#onScrubMove}
        >
          ${marks.map((frame) => html`
            <span
              class="mark"
              data-end=${frame === view.frames ? "true" : nothing}
              style="left: ${percent(frame, view.frames)}"
            >${frame}</span>
          `)}
          <span class="playhead"></span>
        </div>
      </div>
    `;
  }

  #renderRow(
    row: TimelineRow,
    view: TimelineView
  ): TemplateResult {
    return html`
      <div class="row" role="row" data-block=${row.blockId} data-selected=${row.selected ? "true" : "false"}>
        <button
          class="label"
          type="button"
          title=${row.name}
          @click=${() => this.#controller.selectBlock(row.blockId)}
        >${row.name}</button>
        <div
          class="lane"
          @pointerdown=${(event: PointerEvent) => this.#onLanePress(event, row, view)}
          @pointermove=${this.#onKeyDrag}
          @pointerup=${this.#onKeyDrop}
          @pointercancel=${this.#onKeyDragCancel}
          @contextmenu=${(event: MouseEvent) => this.#onLaneMenu(event, row)}
        >
          ${row.keys.map((key) => this.#renderKey(row, key, view))}
          <span class="playhead"></span>
        </div>
      </div>
    `;
  }

  #renderKey(
    row: TimelineRow,
    { tick, interpolation }: TimelineKey,
    view: TimelineView
  ): TemplateResult {
    const selected = view.selectedKeys.has(keyId({ path: row.path, tick }));
    const shift = selected && this.#drag !== null ? frameToTick(this.#drag.frames, view.clip.fps) : 0;

    return html`
      <span
        class="key"
        data-tick=${tick}
        data-interpolation=${interpolation}
        data-selected=${selected ? "true" : "false"}
        style="left: ${percent(tick + shift, view.clip.length)}"
      ></span>
    `;
  }

  readonly #onScrubStart = (
    event: PointerEvent
  ): void => {
    const lane = event.currentTarget;
    if (lane instanceof HTMLElement) {
      lane.setPointerCapture(event.pointerId);
      this.#scrub(lane, event);
    }
  };

  readonly #onScrubMove = (
    event: PointerEvent
  ): void => {
    const lane = event.currentTarget;
    if (lane instanceof HTMLElement && lane.hasPointerCapture(event.pointerId)) {
      this.#scrub(lane, event);
    }
  };

  #scrub(
    lane: HTMLElement,
    event: PointerEvent
  ): void {
    const box = lane.getBoundingClientRect();
    this.#controller.seekFraction(box.width === 0 ? 0 : (event.clientX - box.left) / box.width);
  }

  #onLanePress(
    event: PointerEvent,
    row: TimelineRow,
    view: TimelineView
  ): void {
    const lane = event.currentTarget;
    const tick = keyTickAt(event);
    this.renderRoot.querySelector<HTMLElement>(".rows")?.focus();
    if (event.button !== 0) {
      return;
    }
    if (!(lane instanceof HTMLElement) || tick === null) {
      this.#controller.keys?.clear();

      return;
    }

    this.#controller.pressKey(
      row,
      tick,
      event.shiftKey || event.ctrlKey || event.metaKey
    );
    lane.setPointerCapture(event.pointerId);
    this.#drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      framesPerPixel: view.frames / Math.max(lane.getBoundingClientRect().width, 1),
      frames: 0
    };
  }

  #onLaneMenu(
    event: MouseEvent,
    row: TimelineRow
  ): void {
    event.preventDefault();
    const tick = keyTickAt(event);
    if (tick !== null) {
      this.#controller.pressKey(row, tick, false);
      this.#menu.open(this.#controller.keyMenu(), { x: event.clientX, y: event.clientY });
    }
  }

  readonly #onKeyDrag = (
    event: PointerEvent
  ): void => {
    const drag = this.#drag;
    if (drag === null || drag.pointerId !== event.pointerId) {
      return;
    }

    const frames = Math.round((event.clientX - drag.startX) * drag.framesPerPixel);
    if (frames !== drag.frames) {
      this.#drag = { ...drag, frames };
      this.requestUpdate();
    }
  };

  readonly #onKeyDrop = (
    event: PointerEvent
  ): void => {
    const drag = this.#drag;
    if (drag?.pointerId === event.pointerId) {
      this.#drag = null;
      if (drag.frames === 0) {
        this.requestUpdate();
      }
      else {
        this.#controller.keys?.move(drag.frames);
      }
    }
  };

  readonly #onKeyDragCancel = (): void => {
    this.#drag = null;
    this.requestUpdate();
  };

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    const command = event.ctrlKey || event.metaKey;
    const action = command ?
      kCommandKeys[event.key.toLowerCase()] :
      kPlainKeys[event.key];
    if (action !== undefined) {
      action(this.#controller);
      event.preventDefault();
      event.stopPropagation();
    }
  };
}

function keyTickAt(
  event: Event
): number | null {
  const key = event.target;

  return key instanceof HTMLElement && key.classList.contains("key") ?
    Number(key.dataset.tick) :
    null;
}

function rulerStep(
  frames: number
): number {
  return kRulerSteps.find((step) => frames / step <= kMaxRulerLabels) ?? kWidestRulerStep;
}

function percent(
  value: number,
  total: number
): string {
  return `${total === 0 ? 0 : (value / total) * 100}%`;
}

customElements.define("jolly-model-editor-timeline", Timeline);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-timeline": Timeline;
  }
}
