// Import Internal Dependencies
import { findExample } from "./manifest.ts";
import { GalleryRoot } from "./shell/GalleryRoot.ts";
import type { GalleryExample } from "./types.ts";

const disposed: string[] = [];
window.__galleryDisposed = disposed;

let current: GalleryExample | null = null;
let dispose: (() => void) | void;

function mount(
  example: GalleryExample,
  root: GalleryRoot
) {
  if (current !== null) {
    if (typeof dispose === "function") {
      dispose();
    }
    disposed.push(current.id);
  }

  root.exampleHost.replaceChildren();
  current = example;
  dispose = example.render(root.exampleHost);
  root.setActive(example.id);
  document.title = `${example.title} | jolly-pixel/ui`;
}

function select(
  id: string,
  root: GalleryRoot
) {
  const example = findExample(id);
  const url = new URL(window.location.href);
  url.searchParams.set("example", example.id);
  window.history.pushState({ example: example.id }, "", url);
  mount(example, root);
}

function start() {
  const params = new URLSearchParams(window.location.search);
  const root = document.createElement("gallery-root");

  // `chrome=off` drops the nav, so a test addresses the example without sharing fate with the shell.
  root.setAttribute("chrome", params.get("chrome") === "off" ? "off" : "on");

  const theme = params.get("theme");
  if (theme === "light" || theme === "dark") {
    root.setAttribute("theme", theme);
  }

  document.body.append(root);
  mount(findExample(params.get("example")), root);

  root.addEventListener("gallery-select", (event) => {
    select((event as CustomEvent<{ id: string; }>).detail.id, root);
  });

  window.addEventListener("popstate", () => {
    const id = new URLSearchParams(window.location.search).get("example");
    mount(findExample(id), root);
  });

  window.__galleryReady = true;
}

start();
