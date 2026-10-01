// Import Third-party Dependencies
import * as z from "zod";

// CONSTANTS
const kHoverChangeDetailSchema = z.object({
  hovering: z.boolean()
});

interface HoverChangeDetail {
  hovering: boolean;
}

export interface Suspendable {
  suspend(): () => void;
}

function isHoverChange(
  event: Event
): event is CustomEvent<HoverChangeDetail> {
  if (!(event instanceof CustomEvent)) {
    return false;
  }

  return kHoverChangeDetailSchema.safeParse(
    event.detail
  ).success;
}

export function suspendOnHover(
  suspendable: Suspendable,
  target: EventTarget,
  event: string
): () => void {
  let release: (() => void) | null = null;

  function resume(): void {
    release?.();
    release = null;
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
    else if (release === null) {
      release = suspendable.suspend();
    }
  }
  target.addEventListener(
    event,
    listener
  );

  return () => {
    target.removeEventListener(
      event,
      listener
    );
    resume();
  };
}
