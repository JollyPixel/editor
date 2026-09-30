// Import Third-party Dependencies
import type {
  ContextMenu,
  JollyContextActionDetail,
  JollyContextRequestDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  MenuPoint,
  MenuSession
} from "./menuSession.ts";

export type MenuSurface = Pick<ContextMenu, "items" | "openAt">;

export class ContextMenuController {
  #menu: () => MenuSurface;
  #sessionFor: (id: string | null) => MenuSession;
  #opened: { session: MenuSession; point: MenuPoint; } | null = null;

  constructor(
    menu: () => MenuSurface,
    sessionFor: (id: string | null) => MenuSession
  ) {
    this.#menu = menu;
    this.#sessionFor = sessionFor;
  }

  open(
    session: MenuSession,
    point: MenuPoint
  ): void {
    const menu = this.#menu();
    this.#opened = {
      session,
      point
    };
    menu.items = session.items;
    menu.openAt(point.x, point.y);
  }

  run(
    id: string | null,
    actionId: string,
    point: MenuPoint
  ): Promise<void> | void {
    return this.#sessionFor(id).run(actionId, point);
  }

  readonly onContextRequest = (
    event: CustomEvent<JollyContextRequestDetail>
  ): void => {
    const { id, x, y } = event.detail;
    this.open(this.#sessionFor(id), { x, y });
  };

  readonly onContextAction = (
    event: CustomEvent<JollyContextActionDetail>
  ): void => {
    const opened = this.#opened;
    this.#opened = null;
    void opened?.session.run(event.detail.id, opened.point);
  };
}
