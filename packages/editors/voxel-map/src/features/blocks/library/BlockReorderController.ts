// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import {
  startPointerDragSession,
  type PointerDragResult,
  type PointerDragSessionHandle
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { BlockGrid } from "./BlockGrid.ts";

// CONSTANTS
const kDragThreshold = 4;
const kAutoScrollMargin = 24;
const kAutoScrollStep = 10;

export interface BlockMoveDetail {
  id: number;
  toIndex: number;
}

export interface BlockReorderOptions {
  scroller(): HTMLElement;
  blockAt(clientX: number, clientY: number): number | null;
  insertIndexAt(clientX: number, clientY: number): number | null;
  blockIds(): readonly number[];
  onMove(detail: BlockMoveDetail): void;
}

interface PendingMove {
  blockId: number;
  fromIndex: number;
}

export class BlockReorderController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #options: BlockReorderOptions;
  #session: PointerDragSessionHandle | null = null;
  #dragging = false;
  #insertAt: number | null = null;
  #suppressClick = false;

  constructor(
    host: ReactiveControllerHost,
    options: BlockReorderOptions
  ) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  get dragging(): boolean {
    return this.#dragging;
  }

  get insertAt(): number | null {
    return this.#insertAt;
  }

  begin(
    event: PointerEvent
  ): void {
    if (event.button !== 0 || this.#session !== null) {
      return;
    }

    const blockId = this.#options.blockAt(event.clientX, event.clientY);
    if (blockId === null) {
      return;
    }

    const move: PendingMove = {
      blockId,
      fromIndex: this.#options.blockIds().indexOf(blockId)
    };
    const scroller = this.#options.scroller();
    this.#session = startPointerDragSession({
      element: scroller,
      event,
      threshold: kDragThreshold,
      onStart: () => {
        this.#dragging = true;
        this.#host.requestUpdate();
      },
      onMove: (clientX, clientY, moveEvent) => {
        moveEvent.preventDefault();
        autoScroll(scroller, clientY);
        this.#insertAt = this.#options.insertIndexAt(clientX, clientY);
        this.#host.requestUpdate();
      },
      onFinish: (result, started) => this.#finish(move, result, started)
    });
  }

  consumeClick(): boolean {
    const suppressed = this.#suppressClick;
    this.#suppressClick = false;

    return suppressed;
  }

  hostDisconnected(): void {
    this.#session?.cancel();
  }

  #finish(
    move: PendingMove,
    result: PointerDragResult,
    started: boolean
  ): void {
    const insertAt = this.#insertAt;
    this.#session = null;
    this.#dragging = false;
    this.#insertAt = null;
    this.#suppressClick = started && result === "commit";
    this.#host.requestUpdate();

    if (!this.#suppressClick || insertAt === null) {
      return;
    }

    const toIndex = BlockGrid.moveTarget(
      move.fromIndex,
      insertAt,
      this.#options.blockIds().length
    );
    if (toIndex !== -1) {
      this.#options.onMove({
        id: move.blockId,
        toIndex
      });
    }
  }
}

function autoScroll(
  scroller: HTMLElement,
  clientY: number
): void {
  const bounds = scroller.getBoundingClientRect();
  if (clientY < bounds.top + kAutoScrollMargin) {
    scroller.scrollTop -= kAutoScrollStep;
  }
  else if (clientY > bounds.bottom - kAutoScrollMargin) {
    scroller.scrollTop += kAutoScrollStep;
  }
}
