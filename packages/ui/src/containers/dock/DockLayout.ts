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
} from "../events.ts";
import type { Floating } from "../floating/Floating.ts";
import {
  applyLayoutChange,
  cloneLayout,
  emptyLayout,
  floatPane,
  movePane,
  panePlacement,
  paneVisible,
  reconcileLayout,
  stackPane,
  type DeclaredLayout,
  type LayoutChange,
  type LayoutSnapshot,
  type PanePlacement
} from "./layout.ts";
import {
  parseLayout,
  serializeLayout
} from "./layoutParser.ts";
import { LayoutProjection } from "./LayoutProjection.ts";
import { PaneStepper } from "./PaneStepper.ts";
import { extractSize } from "./extractSize.ts";
import type {
  PaneDragDetail,
  PaneElement
} from "../pane/Pane.ts";
import { isPaneGroup } from "../pane-group/PaneGroup.ts";
import { clampToViewport } from "../../geometry/clampToViewport.ts";
import { defaultStorageAdapter } from "../../storage/defaultStorage.ts";
import { pageNamespace } from "../../storage/keys.ts";
import type { StorageAdapter } from "../../storage/StorageAdapter.ts";

// CONSTANTS
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
    dock: (pane, target, index) => {
      this.#commit(movePane(
        this.#snapshot,
        pane.layoutKey,
        {
          dock: target.dock.layoutKey,
          column: target.column
        },
        index
      ));
    },
    stack: (pane, target, slot, index) => {
      this.#commit(stackPane(
        this.#snapshot,
        pane.layoutKey,
        {
          dock: target.dock.layoutKey,
          column: target.column
        },
        slot,
        index
      ));
    },
    extract: (pane, grab) => this.#extract(pane, grab),
    place: (pane, frame) => this.#place(pane, frame)
  });
  #applying = false;
  #saveQueued = false;
  #keyboardOrigin: LayoutSnapshot | null = null;
  #visibility = new Map<string, boolean>();

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

  placement(
    pane: string
  ): PanePlacement | null {
    return panePlacement(this.#snapshot, pane);
  }

  paneVisible(
    pane: string
  ): boolean {
    return paneVisible(this.#snapshot, pane);
  }

  showPane(
    pane: string
  ): void {
    const next = applyLayoutChange(this.#snapshot, {
      type: "group",
      pane
    });
    if (next !== this.#snapshot) {
      this.#commit(next);
    }
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
    this.#emitVisibility();
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
        this.#refocus(pane, false);
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

    const stepper = new PaneStepper(this.docks());
    const next = stepper.step(this.#snapshot, pane.layoutKey, command);
    if (next !== this.#snapshot) {
      this.#transition(next);
    }

    this.#refocus(pane, true);
    pane.announce(stepper.describe(this.#snapshot, pane.layoutKey, label));
  };

  #refocus(
    pane: PaneElement,
    grabbed: boolean
  ): void {
    const parent = pane.parentElement;
    const group = parent !== null && isPaneGroup(parent) ? parent : null;
    for (const candidate of this.querySelectorAll("jolly-pane-group")) {
      if (candidate !== group) {
        candidate.releaseMoveHandle();
      }
    }
    if (group === null) {
      void pane.focusMoveHandle(grabbed);
    }
    else {
      pane.releaseMoveHandle();
      void group.focusMoveHandle(pane.layoutKey, grabbed);
    }
  }

  #extract(
    pane: PaneElement,
    grab: ExtractGrab
  ): void {
    const group = pane.parentElement;
    const { width, height } = extractSize({
      remembered: this.#snapshot.geometry[pane.layoutKey],
      preferred: {
        width: pane.floatWidth,
        height: pane.floatHeight
      },
      measured: pane.getBoundingClientRect(),
      fallback: group !== null && isPaneGroup(group) ?
        group.getBoundingClientRect() :
        {
          width: 0,
          height: 0
        }
    });
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
    this.#emitVisibility();
  }

  #emitVisibility(): void {
    for (const pane of this.panes()) {
      const key = pane.layoutKey;
      const visible = paneVisible(this.#snapshot, key);
      if (this.#visibility.get(key) === visible) {
        continue;
      }

      this.#visibility.set(key, visible);
      emitContainerEvent(pane, "jolly-pane-visibility", {
        pane: key,
        visible
      });
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
