// Import Third-party Dependencies
import { showChoice } from "@jolly-pixel/ui";

export type OfflineOffer = "retry" | "offline";

export function offerOffline(
  message: string
): Promise<OfflineOffer | null> {
  return showChoice<OfflineOffer>({
    title: "Connection unavailable",
    message,
    actions: [
      {
        value: "retry",
        label: "Retry"
      },
      {
        value: "offline",
        label: "Open offline workspace"
      }
    ],
    focus: "retry"
  });
}
