// Import Third-party Dependencies
import { report } from "@jolly-pixel/bench";
import {
  chromium,
  type Browser
} from "@playwright/test";
import { createServer } from "vite";

// Import Internal Dependencies
import type {
  BrowserBenchmarkReport
} from "./browser/entry.ts";

const server = await createServer({
  root: import.meta.dirname,
  logLevel: "error",
  server: {
    host: "127.0.0.1",
    port: 0
  }
});

let browser: Browser | undefined;
try {
  await server.listen();
  const address = server.httpServer?.address();
  if (
    address === null ||
    address === undefined ||
    typeof address === "string"
  ) {
    throw new Error("The browser benchmark server did not start");
  }

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/browser/index.html`);
  const browserReport = await page.evaluate<BrowserBenchmarkReport>(
    () => window.runPixelDrawBenchmarks()
  );

  report({
    suite: "pixel-draw / browser canvas and rendering",
    runtime: { userAgent: browserReport.runtime.userAgent },
    results: browserReport.results
  });
}
finally {
  await browser?.close();
  await server.close();
}
