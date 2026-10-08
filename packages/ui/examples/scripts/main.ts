// Import Internal Dependencies
import { detailOf } from "../../src/dom.ts";
import { findExample } from "./manifest.ts";
import {
  clearOptions,
  readOptions,
  writeOption
} from "./options.ts";
import { GalleryRoot } from "./shell/GalleryRoot.ts";
import type {
  GalleryEntry,
  GalleryExample
} from "./types.ts";

interface MountedExample {
  entry: GalleryEntry;
  example: GalleryExample;
}

const disposed: string[] = [];
window.__galleryDisposed = disposed;

let current: MountedExample | null = null;
let dispose: (() => void) | void;
let mountTicket = 0;

async function mount(
  entry: GalleryEntry,
  root: GalleryRoot
) {
  const ticket = ++mountTicket;
  const example = await entry.load();
  if (ticket !== mountTicket) {
    return;
  }

  if (current !== null) {
    if (typeof dispose === "function") {
      dispose();
    }
    disposed.push(current.entry.id);
  }

  const values = readOptions(
    example,
    new URLSearchParams(window.location.search)
  );

  root.exampleHost.replaceChildren();
  current = {
    entry,
    example
  };
  dispose = example.render(root.exampleHost, values);
  root.setActive(entry.id);
  root.showOptions(example.options ?? [], values);
  document.title = `${entry.title} | jolly-pixel/ui`;
}

function select(
  id: string,
  root: GalleryRoot
) {
  const entry = findExample(id);
  const url = new URL(window.location.href);

  if (current !== null) {
    clearOptions(current.example, url.searchParams);
  }
  url.searchParams.set("example", entry.id);
  window.history.pushState(
    { example: entry.id },
    "",
    url
  );
  void mount(entry, root);
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
  void mount(current.entry, root);
}

async function start() {
  const params = new URLSearchParams(
    window.location.search
  );
  const root = document.createElement("gallery-root");
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
    void mount(
      findExample(id),
      root
    );
  });

  await mount(
    findExample(params.get("example")),
    root
  );
  window.__galleryReady = true;
}

void start();
