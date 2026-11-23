// Import Third-party Dependencies
import {
  GAME_URL_PATH,
  PLAY_PAGE_PATHNAMES
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { OFFLINE_PARAM } from "./protocol.ts";

export interface PlayRouteSource {
  readonly url: string;
  readonly mode: RequestMode;
}

export function playRoute(
  source: PlayRouteSource,
  root: URL
): string | null {
  const url = new URL(source.url);
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) {
    return null;
  }

  const route = `/${url.pathname.slice(root.pathname.length)}`;
  const served = source.mode === "navigate" ?
    PLAY_PAGE_PATHNAMES.has(route) :
    route.startsWith(GAME_URL_PATH);

  return served ? `${route.slice(1)}${url.search}` : null;
}

export function offlineName(
  page: string | undefined
): string | null {
  const offline = page === undefined ?
    null :
    new URL(page).searchParams.get(OFFLINE_PARAM);

  return offline === "" ? null : offline;
}
