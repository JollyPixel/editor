// Import Internal Dependencies
import type {
  JollyActivateDetail,
  JollyRenameDetail,
  JollyReparentDetail,
  JollySelectDetail,
  JollyToggleExpandDetail,
  JollyToggleLockDetail,
  JollyToggleVisibleDetail
} from "./Tree.types.ts";

export interface DataEventMap {
  "jolly-select": JollySelectDetail;
  "jolly-activate": JollyActivateDetail;
  "jolly-toggle-expand": JollyToggleExpandDetail;
  "jolly-toggle-visible": JollyToggleVisibleDetail;
  "jolly-toggle-lock": JollyToggleLockDetail;
  "jolly-rename": JollyRenameDetail;
  "jolly-reparent": JollyReparentDetail;
}

export function emitDataEvent<KName extends keyof DataEventMap>(
  target: EventTarget,
  name: KName,
  detail: DataEventMap[KName]
): void {
  const event = new CustomEvent<DataEventMap[KName]>(name, {
    detail,
    bubbles: true,
    composed: true
  });
  target.dispatchEvent(event);
}

declare global {
  interface HTMLElementEventMap {
    "jolly-select": CustomEvent<JollySelectDetail>;
    "jolly-activate": CustomEvent<JollyActivateDetail>;
    "jolly-toggle-expand": CustomEvent<JollyToggleExpandDetail>;
    "jolly-toggle-visible": CustomEvent<JollyToggleVisibleDetail>;
    "jolly-toggle-lock": CustomEvent<JollyToggleLockDetail>;
    "jolly-rename": CustomEvent<JollyRenameDetail>;
    "jolly-reparent": CustomEvent<JollyReparentDetail>;
  }
}
