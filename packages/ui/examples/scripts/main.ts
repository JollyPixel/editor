// Import Internal Dependencies
import { detailOf } from "../../src/index.ts";
import { findExample } from "./manifest.ts";
import {
  clearOptions,
  readOptions,
  writeOption
} from "./options.ts";
import { GalleryRoot } from "./shell/GalleryRoot.ts";
import type {
  GalleryExample
} from "./types.ts";

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

  const values = readOptions(
    example,
    new URLSearchParams(window.location.search)
  );

  root.exampleHost.replaceChildren();
  current = example;
  dispose = example.render(root.exampleHost, values);
  root.setActive(example.id);
  root.showOptions(example.options ?? [], values);
  document.title = `${example.title} | jolly-pixel/ui`;
}

function select(
  id: string,
  root: GalleryRoot
) {
  const example = findExample(id);
  const url = new URL(window.location.href);

  if (current !== null) {
    clearOptions(current, url.searchParams);
  }
  url.searchParams.set("example", example.id);
  window.history.pushState(
    { example: example.id },
    "",
    url
  );
  mount(example, root);
}

function toggle(
  key: string,
  value: boolean,
  root: GalleryRoot
) {
  if (current === null) {
    return;
  }

  const url = new URL(window.location.href);
  writeOption(url.searchParams, key, value);
  window.history.replaceState(window.history.state, "", url);
  mount(current, root);
}

function start() {
  const params = new URLSearchParams(
    window.location.search
  );
  const root = document.createElement("gallery-root");

  // `chrome=off` drops the nav, so a test addresses the example without sharing fate with the shell.
  root.setAttribute(
    "chrome",
    params.get("chrome") === "off" ? "off" : "on"
  );

  const theme = params.get("theme");
  if (
    theme === "light" ||
    theme === "dark"
  ) {
    root.setAttribute("theme", theme);
  }

  document.body.append(root);
  mount(
    findExample(params.get("example")),
    root
  );

  root.addEventListener("gallery-select", (event) => {
    const detail = detailOf<{ id: string; }>(event);
    if (detail !== null) {
      select(detail.id, root);
    }
  });

  root.addEventListener("gallery-option", (event) => {
    const detail = detailOf<{ key: string; value: boolean; }>(event);
    if (detail !== null) {
      toggle(detail.key, detail.value, root);
    }
  });

  window.addEventListener("popstate", () => {
    const id = new URLSearchParams(
      window.location.search
    ).get("example");
    mount(
      findExample(id),
      root
    );
  });

  window.__galleryReady = true;
}

start();
