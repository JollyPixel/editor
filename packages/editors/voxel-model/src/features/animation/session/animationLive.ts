// Import Internal Dependencies
import type { AnimationPoser } from "./AnimationPoser.ts";
import type { AnimationSession } from "./AnimationSession.ts";
import type { LiveView } from "../../transform/index.ts";

export function animationLiveView(
  session: Pick<AnimationSession, "shownKey" | "subscribe">,
  poser: Pick<AnimationPoser, "shownTransform">
): LiveView {
  return {
    key: () => session.shownKey,
    shownTransform: (uuid) => poser.shownTransform(uuid),
    subscribe: (listener) => session.subscribe("shown", listener)
  };
}
