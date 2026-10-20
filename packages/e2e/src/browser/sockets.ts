// Import Third-party Dependencies
import type { Page } from "@playwright/test";

// CONSTANTS
const kViteHmrToken = "token=";

export function recordSockets(
  page: Page
): string[] {
  const urls: string[] = [];
  page.on("websocket", (socket) => {
    const url = socket.url();
    if (!url.includes(kViteHmrToken)) {
      urls.push(url);
    }
  });

  return urls;
}
