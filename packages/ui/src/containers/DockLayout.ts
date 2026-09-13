// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import type { Dock } from "./Dock.ts";
import {
  DockLayoutDragController,
  type ExtractGrab
} from "./DockLayoutDragController.ts";
import {
  emitContainerEvent,
  type PaneFoldersDetail,
  type PaneMoveDetail
} from "./events.ts";
import type { Floating } from "./Floating.ts";
import {
  applyLayoutChange,
  cloneLayout,
  emptyLayout,
  floatPane,
  movePane,
  panePlacement,
  parseLayout,
  reconcileLayout,
  serializeLayout,
  type DeclaredLayout,
  type LayoutChange,
  type LayoutSnapshot
} from "./layout.ts";
import { LayoutProjection } from "./LayoutProjection.ts";
import type {
  PaneDragDetail,
  PaneElement
} from "./Pane.ts";
import { clampToViewport } from "../geometry/clampToViewport.ts";
import { defaultStorageAdapter } from "../storage/defaultStorage.ts";
import { pageNamespace } from "../storage/keys.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";

// CONSTANTS
const kExtractMinWidth = 160;
const kExtractMinHeight = 80;
const kGrabInset = 24;

/**
 * Coordinates a set of docks, the panes inside them, and the floating windows
 * panes are dragged out into.
 */
@customElement("jolly-dock-layout")
export class DockLayout extends LitElement {
  static override styles = css`
    :host {
      display: contents;
    }
  `;

  @property({ type: String, attribute: "storage-key" })
  declare storageKey: string;

  @property({ attribute: false })
  declare storage: StorageAdapter;

  #declared: DeclaredLayout | null = null;
  #snapshot: LayoutSnapshot = emptyLayout();
  #projection = new LayoutProjection(this);
  #drag = new DockLayoutDragController({
    docks: () => this.docks(),
    dock: (pane, dock, index) => {
      this.#commit(movePane(
        this.#snapshot,
        pane.layoutKey,
        dock.layoutKey,
        index
      ));
    },
    extract: (pane, grab) => this.#extract(pane, grab),
    place: (pane, frame) => this.#place(pane, frame)
  });
  #applying = false;
  #saveQueued = false;
  #keyboardOrigin: LayoutSnapshot | null = null;

  constructor() {
    super();

    this.storageKey = "";
    this.storage = defaultStorageAdapter();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("jolly-pane-drag", this.#onPaneDrag);
    this.addEventListener("jolly-pane-move", this.#onPaneMove);
    this.addEventListener("jolly-pane-folders", this.#onPaneFolders);
    this.addEventListener("jolly-layout-dirty", this.#onLayoutChange);
  }

  override disconnectedCallback(): void {
    this.removeEventListener("jolly-pane-drag", this.#onPaneDrag);
    this.removeEventListener("jolly-pane-move", this.#onPaneMove);
    this.removeEventListener("jolly-pane-folders", this.#onPaneFolders);
    this.removeEventListener("jolly-layout-dirty", this.#onLayoutChange);
    this.#drag.cancel();
    super.disconnectedCallback();
  }

  override render(): TemplateResult {
    return html`<slot @slotchange=${this.#onSlotChange}></slot>`;
  }

  protected override firstUpdated(): void {
    this.#declared = this.#projection.readDeclared();
    this.#snapshot = reconcileLayout(
      parseLayout(this.storage.get(this.#namespace())),
      this.#declared
    );
    this.#project();
  }

  docks(): Dock[] {
    return [...this.querySelectorAll("jolly-dock")].filter(
      (dock) => dock.closest("jolly-dock-layout") === this
    );
  }

  panes(): PaneElement[] {
    return [...this.querySelectorAll("jolly-pane")].filter(
      (pane) => pane.closest("jolly-dock-layout") === this
    );
  }

  sync(): void {
    if (this.#applying) {
      return;
    }

    this.#snapshot = reconcileLayout(
      this.#snapshot,
      this.#projection.readDeclared()
    );
    this.#project();
  }

  resetLayout(): void {
    this.storage.set(this.#namespace(), "");
    this.#snapshot = reconcileLayout(
      null,
      this.#declared ?? this.#projection.readDeclared()
    );
    this.#project();
    emitContainerEvent(this, "jolly-layout-change", {
      snapshot: cloneLayout(this.#snapshot)
    });
  }

  snapshot(): LayoutSnapshot {
    return cloneLayout(this.#snapshot);
  }

  #onSlotChange = () => {
    if (this.#applying || !this.hasUpdated) {
      return;
    }

    this.sync();
  };

  #onLayoutChange = (
    event: CustomEvent<LayoutChange>
  ) => {
    if (this.#applying) {
      return;
    }

    this.#snapshot = applyLayoutChange(this.#snapshot, event.detail);
    if (this.#saveQueued) {
      return;
    }

    this.#saveQueued = true;
    queueMicrotask(() => {
      this.#saveQueued = false;
      this.#save();
    });
  };

  #onPaneFolders = (
    event: CustomEvent<PaneFoldersDetail>
  ) => {
    event.stopPropagation();
    this.#projection.applyFolders(event.detail.pane, this.#snapshot);
  };

  #onPaneDrag = (
    event: CustomEvent<PaneDragDetail>
  ) => {
    if (this.#drag.active) {
      return;
    }

    event.stopPropagation();
    this.#drag.start(event.detail);
  };

  #onPaneMove = (
    event: CustomEvent<PaneMoveDetail>
  ) => {
    event.stopPropagation();
    const { pane, command } = event.detail;
    const label = pane.heading || pane.layoutKey;

    if (command === "start") {
      this.#keyboardOrigin = this.#snapshot;
      pane.announce(`${label} grabbed`);

      return;
    }
    if (command === "cancel") {
      if (this.#keyboardOrigin !== null) {
        this.#transition(this.#keyboardOrigin);
      }
      this.#keyboardOrigin = null;
      pane.announce(`${label} movement cancelled`);

      return;
    }
    if (command === "finish") {
      this.#keyboardOrigin = null;
      this.#save();
      pane.announce(`${label} dropped`);

      return;
    }

    if (command === "up" || command === "down") {
      this.#nudge(pane, command === "up" ? -1 : 1);
    }
    else {
      this.#shift(pane, command === "previous" ? -1 : 1);
    }

    pane.announce(this.#positionOf(pane, label));
  };

  #nudge(
    pane: PaneElement,
    offset: number
  ): void {
    const placement = panePlacement(this.#snapshot, pane.layoutKey);
    if (placement === null) {
      return;
    }

    const to = Math.min(
      Math.max(placement.index + offset, 0),
      placement.count - 1
    );
    if (placement.index === to) {
      return;
    }

    this.#transition(movePane(
      this.#snapshot,
      pane.layoutKey,
      placement.dock,
      offset > 0 ? to + 1 : to
    ));
  }

  #shift(
    pane: PaneElement,
    offset: number
  ): void {
    const docks = this.docks()
      .map((dock) => dock.layoutKey)
      .filter((key) => this.#snapshot.docks[key] !== undefined);
    if (docks.length === 0) {
      return;
    }

    const placement = panePlacement(this.#snapshot, pane.layoutKey);
    const index = placement === null ?
      -1 :
      docks.indexOf(placement.dock);
    const next = Math.min(
      Math.max(index === -1 ? offset * docks.length : index + offset, 0),
      docks.length - 1
    );
    if (index === next) {
      return;
    }

    this.#transition(movePane(
      this.#snapshot,
      pane.layoutKey,
      docks[next],
      this.#snapshot.docks[docks[next]].panes.length
    ));
  }

  #extract(
    pane: PaneElement,
    grab: ExtractGrab
  ): void {
    const rect = pane.getBoundingClientRect();
    const remembered = this.#snapshot.geometry[pane.layoutKey];
    const width = Math.max(
      remembered?.width ?? rect.width,
      kExtractMinWidth
    );
    const height = Math.max(
      remembered?.height ?? rect.height,
      kExtractMinHeight
    );
    let x = grab.x - Math.min(grab.offsetX, Math.max(width - kGrabInset, 0));
    let y = grab.y - Math.min(grab.offsetY, Math.max(height - kGrabInset, 0));

    const view = this.ownerDocument.defaultView;
    if (view !== null) {
      ({ x, y } = clampToViewport({
        x,
        y,
        rect: {
          width,
          height
        },
        viewport: {
          width: view.innerWidth,
          height: view.innerHeight
        }
      }));
    }

    this.#commit(floatPane(
      this.#snapshot,
      pane.layoutKey,
      {
        x,
        y,
        width,
        height
      }
    ));
  }

  #place(
    pane: PaneElement,
    frame: Floating
  ): void {
    this.#commit(applyLayoutChange(
      this.#snapshot,
      {
        type: "floating",
        pane: pane.layoutKey,
        geometry: {
          x: frame.x,
          y: frame.y
        }
      }
    ));
  }

  #positionOf(
    pane: PaneElement,
    label: string
  ): string {
    const placement = panePlacement(this.#snapshot, pane.layoutKey);
    const dock = placement === null ?
      undefined :
      this.docks().find((candidate) => candidate.layoutKey === placement.dock);
    if (placement === null || dock === undefined) {
      return `${label}, floating`;
    }

    return `${label}, ${dock.side} dock, position ` +
      `${placement.index + 1} of ${placement.count}`;
  }

  #commit(
    snapshot: LayoutSnapshot
  ): void {
    this.#transition(snapshot);
    this.#save();
  }

  #transition(
    snapshot: LayoutSnapshot
  ): void {
    this.#snapshot = snapshot;
    this.#project();
  }

  #project(): void {
    this.#applying = true;
    try {
      this.#projection.apply(this.#snapshot);
    }
    finally {
      this.#applying = false;
    }
  }

  #save(): void {
    this.storage.set(
      this.#namespace(),
      serializeLayout(this.#snapshot)
    );
    emitContainerEvent(this, "jolly-layout-change", {
      snapshot: cloneLayout(this.#snapshot)
    });
  }

  #namespace(): string {
    return pageNamespace(this.storageKey, "jolly-dock-layout");
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-dock-layout": DockLayout;
  }
}
