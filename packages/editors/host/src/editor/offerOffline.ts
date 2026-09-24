// Import Third-party Dependencies
import { showChoice } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { LaunchNotFoundError } from "../launch/errors/LaunchNotFoundError.ts";
import { CatalogUnavailableError } from "../session/errors/CatalogUnavailableError.ts";

export type OfflineOffer = "retry" | "offline";

export interface OfflineFallbackOptions<TValue> {
  message: string;
  online: () => Promise<TValue>;
  offline: () => Promise<TValue>;
}

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

export async function withOfflineFallback<TValue>(
  options: OfflineFallbackOptions<TValue>
): Promise<TValue> {
  for (;;) {
    try {
      return await options.online();
    }
    catch (error) {
      if (
        !(error instanceof CatalogUnavailableError) &&
        !(error instanceof LaunchNotFoundError)
      ) {
        throw error;
      }

      const choice = await offerOffline(options.message);
      if (choice === "offline") {
        return options.offline();
      }
      if (choice === null) {
        throw error;
      }
    }
  }
}
