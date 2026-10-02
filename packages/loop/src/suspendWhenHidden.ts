// Import Internal Dependencies
import type { GameLoop } from "./GameLoop.ts";

export function suspendWhenHidden(
  loop: GameLoop,
  target: Element,
  signal: AbortSignal
): void {
  let suspended = false;
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.at(-1)?.isIntersecting === true;
    if (!visible && loop.running) {
      loop.stop();
      suspended = true;
    }
    else if (visible && suspended) {
      suspended = false;
      loop.start();
    }
  });
  const unsubscribe = loop.subscribe("start", () => {
    suspended = false;
  });

  observer.observe(target);
  signal.addEventListener(
    "abort",
    () => {
      observer.disconnect();
      unsubscribe();
    },
    { once: true }
  );
}
