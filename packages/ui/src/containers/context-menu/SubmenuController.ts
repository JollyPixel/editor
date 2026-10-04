// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import {
  placeSubmenu,
  type SubmenuSide
} from "./submenuPlacement.ts";
import { placePopover } from "../../field/placePopover.ts";

// CONSTANTS
const kOpenDelay = 150;
const kCloseDelay = 300;

export interface SubmenuControllerOptions {
  root: () => HTMLElement;
}

interface Branch {
  key: string;
  menu: HTMLElement;
}

interface SubmenuLevel extends Branch {
  item: HTMLButtonElement;
  side: SubmenuSide;
}

export class SubmenuController implements ReactiveController {
  #host: ReactiveControllerHost;
  #options: SubmenuControllerOptions;
  #levels: SubmenuLevel[] = [];
  #refocus: HTMLButtonElement | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    host: ReactiveControllerHost,
    options: SubmenuControllerOptions
  ) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  expanded(
    key: string
  ): boolean {
    return this.#levels.some(
      (level) => level.key === key
    );
  }

  hover(
    item: HTMLButtonElement
  ): void {
    this.cancelHover();
    const depth = this.#depthOf(item);
    if (depth === -1) {
      return;
    }

    const current = this.#levels.at(
      depth
    )?.item ?? null;
    const wanted = branchOf(item) === null ? null : item;
    if (wanted === current) {
      return;
    }

    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      if (wanted === null) {
        this.#closeFrom(depth);
      }
      else {
        this.open(wanted, false);
      }
    }, current === null ? kOpenDelay : kCloseDelay);
  }

  readonly cancelHover = (): void => {
    clearTimeout(this.#timer);
    this.#timer = undefined;
  };

  open(
    item: HTMLButtonElement,
    focus: boolean
  ): void {
    this.cancelHover();
    const branch = branchOf(item);
    const depth = this.#depthOf(item);
    if (
      branch === null ||
      depth === -1 ||
      !this.#options.root().matches(":popover-open")
    ) {
      return;
    }

    if (this.#levels.at(depth)?.item !== item) {
      this.#closeFrom(depth);
      branch.menu.showPopover();
      const level: SubmenuLevel = {
        ...branch,
        item,
        side: "right"
      };
      this.#levels.push(level);
      this.#place(
        level,
        this.#levels.at(depth - 1)?.side ?? "right"
      );
      this.#host.requestUpdate();
    }

    if (focus) {
      levelItems(branch.menu).find(
        (button) => !button.disabled
      )?.focus();
    }
  }

  back(
    menu: HTMLElement
  ): void {
    const depth = this.#levels.findIndex(
      (level) => level.menu === menu
    );
    if (depth !== -1) {
      this.#closeFrom(depth);
    }
  }

  closeAll(): void {
    this.cancelHover();
    this.#closeFrom(0);
  }

  reposition(): void {
    let side: SubmenuSide = "right";
    for (const level of this.#levels) {
      side = this.#place(level, side);
    }
  }

  readonly onBeforeToggle = (
    event: ToggleEvent
  ): void => {
    const depth = this.#levels.findIndex(
      (level) => level.menu === event.currentTarget
    );
    if (event.newState === "open" || depth === -1) {
      return;
    }

    const level = this.#levels[depth];
    if (level.menu.matches(":focus-within")) {
      this.#refocus = level.item;
    }
    this.#levels.length = depth;
    this.#host.requestUpdate();
  };

  readonly onToggle = (): void => {
    const item = this.#refocus;
    this.#refocus = null;
    if (
      item !== null &&
      this.#options.root().matches(":popover-open")
    ) {
      item.focus();
    }
  };

  hostDisconnected(): void {
    this.cancelHover();
    this.#levels = [];
    this.#refocus = null;
  }

  #closeFrom(
    depth: number
  ): void {
    this.#levels.at(depth)?.menu.hidePopover();
  }

  #depthOf(
    item: HTMLElement
  ): number {
    const menu = item.parentElement?.closest(".menu");
    if (menu === this.#options.root()) {
      return 0;
    }

    const index = this.#levels.findIndex((level) => level.menu === menu);

    return index === -1 ? -1 : index + 1;
  }

  #place(
    level: SubmenuLevel,
    prefer: SubmenuSide
  ): SubmenuSide {
    const item = level.item.getBoundingClientRect();
    const padding = Number.parseFloat(
      getComputedStyle(level.menu).paddingTop
    ) || 0;
    const placed = placePopover(
      level.menu,
      item,
      (panel, viewport) => placeSubmenu({
        item,
        panel,
        viewport,
        padding,
        side: prefer
      })
    );
    level.side = placed.side;

    return placed.side;
  }
}

export function levelItems(
  menu: Element
): HTMLButtonElement[] {
  return [
    ...menu.querySelectorAll<HTMLButtonElement>(
      ":scope > .item, :scope > .branch > .item"
    )
  ];
}

function branchOf(
  item: HTMLButtonElement
): Branch | null {
  const key = item.dataset.submenu;
  const menu = item.nextElementSibling;

  return key !== undefined && !item.disabled && menu instanceof HTMLElement ?
    {
      key,
      menu
    } :
    null;
}
