const kSuspensions = new WeakMap<Suspendable, Suspension>();

interface Suspension {
  readonly enabled: boolean;
  holders: number;
}

interface HoverChangeDetail {
  hovering: boolean;
}

export interface Suspendable {
  enabled: boolean;
}

function isHoverChange(
  event: Event
): event is CustomEvent<HoverChangeDetail> {
  if (!(event instanceof CustomEvent)) {
    return false;
  }
  const detail: unknown = event.detail;

  return typeof detail === "object" &&
    detail !== null &&
    "hovering" in detail &&
    typeof detail.hovering === "boolean";
}

export function suspendOnHover(
  suspendable: Suspendable,
  target: EventTarget,
  event: string
): () => void {
  let suspension: Suspension | undefined;

  function resume(): void {
    if (suspension === undefined) {
      return;
    }
    suspension.holders--;
    if (suspension.holders === 0) {
      suspendable.enabled = suspension.enabled;
      kSuspensions.delete(suspendable);
    }
    suspension = undefined;
  }

  function listener(
    hoverEvent: Event
  ): void {
    if (!isHoverChange(hoverEvent)) {
      return;
    }
    if (!hoverEvent.detail.hovering) {
      resume();
    }
    else if (suspension === undefined) {
      suspension = kSuspensions.get(suspendable) ?? {
        enabled: suspendable.enabled,
        holders: 0
      };
      suspension.holders++;
      kSuspensions.set(suspendable, suspension);
      suspendable.enabled = false;
    }
  }
  target.addEventListener(event, listener);

  return () => {
    target.removeEventListener(event, listener);
    resume();
  };
}
