// Import Third-party Dependencies
import type { Page } from "@playwright/test";

export function recordSockets(
  page: Page
): string[] {
  const urls: string[] = [];
  page.on("websocket", (socket) => {
    const url = socket.url();
    if (!url.includes("token=")) {
      urls.push(url);
    }
  });

  return urls;
}
