// Import Third-party Dependencies
import { PLAY_PAGE_DIR } from "@jolly-pixel/server";

// Import Internal Dependencies
import { offlineName } from "./offlineRequest.ts";
import { PLAY_WORKER_FILE } from "../../../shared/playWorker.ts";

// CONSTANTS
const kReloadedParam = "worker";

export function supportsOfflinePlay(): boolean {
  return globalThis.navigator?.serviceWorker !== undefined;
}

export function registerPlayWorker(
  studioRoot: string | URL
): Promise<ServiceWorkerRegistration> {
  const scope = new URL(`${PLAY_PAGE_DIR}/`, studioRoot);

  return navigator.serviceWorker.register(
    new URL(PLAY_WORKER_FILE, scope),
    { scope: scope.href }
  );
}

export async function awaitPlayWorker(
  page: Location
): Promise<void> {
  if (offlineName(page.href) === null) {
    return;
  }
  if (!supportsOfflinePlay()) {
    throw new Error("Playing offline needs https or localhost.");
  }
  if (navigator.serviceWorker.controller !== null) {
    return;
  }

  const url = new URL(page.href);
  if (url.searchParams.has(kReloadedParam)) {
    throw new Error(
      "The game skipped its service worker: reload the page normally."
    );
  }

  await registerPlayWorker(new URL("../", url));
  await navigator.serviceWorker.ready;
  url.searchParams.set(kReloadedParam, "");
  page.replace(url);
  await Promise.withResolvers<never>().promise;
}
