// Import Internal Dependencies
import {
  PLAY_ACCEPTED,
  PLAY_REQUEST,
  PLAY_ROOT,
  PLAY_TIMEOUT_MS,
  parsePlayReply,
  playChannelName,
  type PlayRequest,
  type PlayResponse
} from "./protocol.ts";

// CONSTANTS
const kServedMethod = "GET";
const kUnavailable = 503;
const kUnavailableMessage = "No studio tab is open: " +
  "open the studio in this browser to play offline.";

interface PendingRequest {
  readonly resolve: (response: Response) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class OfflinePlayClient {
  #channel: BroadcastChannel;
  #pending = new Map<string, PendingRequest>();

  constructor(
    offline: string
  ) {
    this.#channel = new BroadcastChannel(playChannelName(offline));
    this.#channel.addEventListener("message", (event) => {
      const reply = parsePlayReply(event.data);
      const pending = reply === undefined ?
        undefined :
        this.#pending.get(reply.id);
      if (reply === undefined || pending === undefined) {
        return;
      }

      if (reply.type === PLAY_ACCEPTED) {
        clearTimeout(pending.timer);
        pending.timer = this.#expiry(reply.id);
      }
      else {
        this.#settle(reply.id, toResponse(reply));
      }
    });
  }

  request(
    path: string
  ): Promise<Response> {
    const { promise, resolve } = Promise.withResolvers<Response>();
    const id = crypto.randomUUID();
    this.#pending.set(id, {
      resolve,
      timer: this.#expiry(id)
    });
    this.#channel.postMessage({
      type: PLAY_REQUEST,
      id,
      path
    } satisfies PlayRequest);

    return promise;
  }

  readonly fetch = (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const request = new Request(input, init);
    if (request.method !== kServedMethod || !request.url.startsWith(PLAY_ROOT)) {
      return Promise.reject(new TypeError(
        `offline Play serves only GET requests under ${PLAY_ROOT}`
      ));
    }

    return this.request(request.url.slice(PLAY_ROOT.length));
  };

  close(): void {
    for (const id of this.#pending.keys()) {
      this.#settle(id, unavailable());
    }
    this.#channel.close();
  }

  #expiry(
    id: string
  ): ReturnType<typeof setTimeout> {
    return setTimeout(() => this.#settle(id, unavailable()), PLAY_TIMEOUT_MS);
  }

  #settle(
    id: string,
    response: Response
  ): void {
    const pending = this.#pending.get(id);
    if (pending !== undefined) {
      clearTimeout(pending.timer);
      this.#pending.delete(id);
      pending.resolve(response);
    }
  }
}

function toResponse(
  reply: PlayResponse
): Response {
  return new Response(reply.body.slice(), {
    status: reply.status,
    headers: {
      "content-type": reply.contentType,
      "cache-control": reply.cacheControl
    }
  });
}

function unavailable(): Response {
  return new Response(JSON.stringify({
    code: "project-unavailable",
    message: kUnavailableMessage
  }), {
    status: kUnavailable,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    }
  });
}
