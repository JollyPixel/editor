// Import Internal Dependencies
import type { ContextMenu } from "./ContextMenu.ts";
import type { JollyContextActionDetail } from "../events.ts";
import type { JollyContextRequestDetail } from "../../data/tree/contract.ts";
import type {
  MenuPoint,
  MenuSession
} from "./MenuSession.ts";

export type MenuSurface = Pick<ContextMenu, "items" | "openAt">;

export class ContextMenuController {
  #menu: () => MenuSurface;
  #openSession: (id: string | null) => MenuSession;
  #opened: { session: MenuSession; point: MenuPoint; } | null = null;

  constructor(
    menu: () => MenuSurface,
    openSession: (id: string | null) => MenuSession
  ) {
    this.#menu = menu;
    this.#openSession = openSession;
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
    return this.#openSession(id).run(actionId, point);
  }

  readonly onContextRequest = (
    event: CustomEvent<JollyContextRequestDetail>
  ): void => {
    const { id, x, y } = event.detail;
    this.open(this.#openSession(id), { x, y });
  };

  readonly onContextAction = (
    event: CustomEvent<JollyContextActionDetail>
  ): void => {
    const opened = this.#opened;
    this.#opened = null;
    void opened?.session.run(event.detail.id, opened.point);
  };
}
