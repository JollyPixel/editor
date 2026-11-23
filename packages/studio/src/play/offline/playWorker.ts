// Import Internal Dependencies
import { OfflinePlayClient } from "./OfflinePlayClient.ts";
import {
  offlineName,
  playRoute
} from "./offlineRequest.ts";

interface WorkerClient {
  readonly url: string;
}

interface LifecycleEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface PlayFetchEvent extends Event {
  readonly request: Request;
  readonly clientId: string;
  respondWith(response: Promise<Response>): void;
}

interface PlayWorkerScope {
  readonly location: Location;
  readonly clients: {
    get(id: string): Promise<WorkerClient | undefined>;
    claim(): Promise<void>;
  };
  skipWaiting(): Promise<void>;
  addEventListener(type: "install" | "activate", listener: (event: LifecycleEvent) => void): void;
  addEventListener(type: "fetch", listener: (event: PlayFetchEvent) => void): void;
}

// CONSTANTS
const kScope = globalThis as unknown as PlayWorkerScope;
const kRoot = new URL("../", kScope.location.href);
const kClients = new Map<string, OfflinePlayClient>();

function playClient(
  offline: string
): OfflinePlayClient {
  let client = kClients.get(offline);
  if (client === undefined) {
    client = new OfflinePlayClient(offline);
    kClients.set(offline, client);
  }

  return client;
}

async function respond(
  event: PlayFetchEvent,
  path: string
): Promise<Response> {
  const { request } = event;
  const page = request.mode === "navigate" ?
    request.url :
    (await kScope.clients.get(event.clientId))?.url;
  const offline = offlineName(page);

  return offline === null ?
    fetch(request) :
    playClient(offline).request(path);
}

kScope.addEventListener("install", (event) => {
  event.waitUntil(kScope.skipWaiting());
});
kScope.addEventListener("activate", (event) => {
  event.waitUntil(kScope.clients.claim());
});
kScope.addEventListener("fetch", (event) => {
  const { request } = event;
  const path = request.method === "GET" ? playRoute(request, kRoot) : null;
  if (path !== null) {
    event.respondWith(respond(event, path));
  }
});
