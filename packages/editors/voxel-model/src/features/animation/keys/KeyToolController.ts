// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";
import type { ShortcutLabels } from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { AnimationKeyer } from "./AnimationKeyer.ts";
import type { AnimationSession } from "../session/AnimationSession.ts";
import {
  keySelectedBlock,
  type KeySelectedOptions
} from "./animationShortcuts.ts";
import type { ModelAccessSignals } from "../../../access/ModelAccess.ts";
import type { ModelAction } from "../../../keybindings/modelActions.ts";

// CONSTANTS
const kKeyTitle = "Key selected block";

export interface KeyToolEditing extends KeySelectedOptions {
  access: Pick<ModelAccessSignals, "subscribe">;
  animationSession: Pick<AnimationSession, "active" | "subscribe">;
  keyer: Pick<AnimationKeyer, "canKey" | "keyBlock">;
  shortcuts: Pick<ShortcutLabels<ModelAction>, "label" | "subscribe">;
}

export class KeyToolController {
  #connection: SubscriptionController<KeyToolEditing>;

  constructor(
    host: ReactiveControllerHost
  ) {
    function refresh(): void {
      host.requestUpdate();
    }
    this.#connection = new SubscriptionController(host, ({ access, animationSession, shortcuts }) => [
      access.subscribe("change", refresh),
      animationSession.subscribe("active", refresh),
      animationSession.subscribe("clip", refresh),
      shortcuts.subscribe(refresh)
    ]);
  }

  get shown(): boolean {
    return this.#connection.current?.animationSession.active ?? false;
  }

  get enabled(): boolean {
    return this.#connection.current?.keyer.canKey ?? false;
  }

  get title(): string {
    return this.#connection.current?.shortcuts.label(kKeyTitle, "animation.key") ?? kKeyTitle;
  }

  attach(
    editing: KeyToolEditing
  ): void {
    this.#connection.attach(editing);
  }

  key(): void {
    const editing = this.#connection.current;
    if (editing !== null) {
      keySelectedBlock(editing);
    }
  }
}
