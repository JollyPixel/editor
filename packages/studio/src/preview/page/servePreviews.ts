// Import Third-party Dependencies
import { errorMessage } from "@jolly-pixel/utils";

// Import Internal Dependencies
import {
  parsePreviewRequest,
  type PreviewReply
} from "../protocol.ts";

export interface PreviewRenderer {
  render(
    assetId: string,
    size: number
  ): Promise<Uint8Array<ArrayBuffer>>;
}

export function servePreviews(
  port: MessagePort,
  renderer: Promise<PreviewRenderer>
): void {
  let chain = Promise.resolve();
  port.addEventListener("message", (event) => {
    const request = parsePreviewRequest(event.data);
    if (request !== undefined) {
      chain = chain.then(() => reply(
        port,
        request.id,
        renderer.then((ready) => ready.render(request.assetId, request.size))
      ));
    }
  });
  port.start();
}

async function reply(
  port: MessagePort,
  id: number,
  rendering: Promise<Uint8Array<ArrayBuffer>>
): Promise<void> {
  let message: PreviewReply;
  try {
    message = {
      type: "rendered",
      id,
      bytes: await rendering
    };
  }
  catch (error) {
    message = {
      type: "failed",
      id,
      reason: errorMessage(error)
    };
  }
  port.postMessage(
    message,
    message.type === "rendered" ? [message.bytes.buffer] : []
  );
}
