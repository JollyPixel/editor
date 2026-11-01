// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Preferences } from "@jolly-pixel/preferences";

// Import Internal Dependencies
import {
  EditorFrames,
  type EditorFramesOptions
} from "../../src/tabs/EditorFrames.ts";
import { idleShare } from "./catalogShare.ts";
import { PreferenceScopes } from "../../shared/PreferenceScopes.ts";

// CONSTANTS
export const FRAME_ORIGIN = "http://localhost";

let current: EditorFrames | undefined;

export function editorFrames(
  options: Partial<EditorFramesOptions> = {}
): EditorFrames {
  const container = document.createElement("div");
  document.body.append(container);
  current = new EditorFrames({
    container,
    launchOrigin: FRAME_ORIGIN,
    share: idleShare(),
    ...options,
    preferences: options.preferences ?? new Preferences(),
    scopes: options.scopes ?? new PreferenceScopes([], [])
  });

  return current;
}

export function scope(): HTMLElement {
  const element = document.createElement("jolly-scope");
  element.setAttribute("theme", "dark");
  element.setAttribute("density", "comfortable");
  document.body.append(element);

  return element;
}

export function frame(): HTMLIFrameElement {
  const element = document.querySelector("iframe");
  assert.ok(element);

  return element;
}

export function recordPosts(
  target: HTMLIFrameElement
): Array<[unknown, string]> {
  const posted: Array<[unknown, string]> = [];
  assert.ok(target.contentWindow);
  Object.assign(target.contentWindow, {
    postMessage: (message: unknown, origin: string) => {
      posted.push([message, origin]);
    }
  });

  return posted;
}

export function postFrom(
  source: MessageEventSource | null,
  data: unknown
): void {
  window.dispatchEvent(new MessageEvent("message", {
    source,
    origin: FRAME_ORIGIN,
    data
  }));
}

export function disposeFrames(): void {
  current?.dispose();
  current = undefined;
  document.body.replaceChildren();
}
