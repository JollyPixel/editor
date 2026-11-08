// Import Third-party Dependencies
import contributions from "virtual:jolly-pixel/contributions/scene";
import {
  ShellChannel,
  parseLaunchMessage,
  type FrameMessage
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import { parsePreviewRequests } from "../protocol.ts";
import { AssetRenderer } from "./AssetRenderer.ts";
import { connectPreview } from "./connectPreview.ts";
import { PreviewKinds } from "./PreviewKinds.ts";
import { servePreviews } from "./servePreviews.ts";

// CONSTANTS
const kCanvas = "#preview-canvas";

interface PreviewLaunch {
  shell: ShellChannel;
  requests: MessagePort;
}

async function waitForLaunch(): Promise<PreviewLaunch> {
  const { parent } = window;
  const shell = Promise.withResolvers<ShellChannel>();
  const requests = Promise.withResolvers<MessagePort>();
  const listening = new AbortController();
  window.addEventListener("message", (event) => {
    if (event.source !== parent || event.origin !== location.origin) {
      return;
    }
    const launch = parseLaunchMessage(event.data);
    if (launch !== undefined) {
      shell.resolve(new ShellChannel({
        port: parent,
        origin: event.origin,
        launch
      }));
    }
    const opened = parsePreviewRequests(event.data);
    if (opened !== undefined) {
      requests.resolve(opened.port);
    }
  }, { signal: listening.signal });
  parent.postMessage(
    { type: "jolly-ready" } satisfies FrameMessage,
    location.origin
  );

  try {
    const [channel, port] = await Promise.all([
      shell.promise,
      requests.promise
    ]);

    return {
      shell: channel,
      requests: port
    };
  }
  finally {
    listening.abort();
  }
}

async function boot(): Promise<void> {
  const { shell, requests } = await waitForLaunch();
  const renderer = connectPreview(shell).then(
    (session) => AssetRenderer.create({
      canvas: kCanvas,
      kinds: new PreviewKinds(contributions),
      session
    })
  );
  renderer.catch((error: unknown) => {
    console.error("[preview] The asset preview cannot render.", error);
  });
  servePreviews(requests, renderer);
}

void boot();
