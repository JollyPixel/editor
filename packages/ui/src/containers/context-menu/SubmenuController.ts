// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import {
  placeSubmenu,
  submenuSide,
  type SubmenuSide
} from "./submenuPlacement.ts";
import { placePopover } from "../../field/placePopover.ts";
import type { AnchorRect } from "../../geometry/anchoredPosition.ts";

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
      this.#levels.push({
        ...branch,
        item,
        side: "right"
      });
      this.reposition();
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
    let menu = this.#options.root();
    let side = chooseOpening(menu, "right");
    for (const level of this.#levels) {
      menu.dataset.opens = this.#place(level, menu, side);
      menu = level.menu;
      side = chooseOpening(menu, level.side);
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
    parent: HTMLElement,
    prefer: SubmenuSide
  ): SubmenuSide {
    const item = layoutRect(parent, level.item);
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

function chooseOpening(
  menu: HTMLElement,
  prefer: SubmenuSide
): SubmenuSide {
  const side = submenuSide({
    menu: layoutRect(menu),
    budget: Number.parseFloat(
      getComputedStyle(menu).maxWidth
    ) || menu.offsetWidth,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    prefer
  });
  menu.dataset.opens = side;

  return side;
}

function layoutRect(
  menu: HTMLElement,
  element: HTMLElement = menu
): AnchorRect {
  const nested = element !== menu;
  const left = Number.parseFloat(menu.style.left) +
    (nested ? element.offsetLeft - menu.scrollLeft : 0);
  const top = Number.parseFloat(menu.style.top) +
    (nested ? element.offsetTop - menu.scrollTop : 0);

  return {
    top,
    bottom: top + element.offsetHeight,
    left,
    right: left + element.offsetWidth
  };
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
