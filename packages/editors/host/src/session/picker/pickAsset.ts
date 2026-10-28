// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import {
  readDetail,
  type JollyChangeDetail
} from "@jolly-pixel/ui";
import { Button } from "@jolly-pixel/ui/elements/button";
import { Dialog } from "@jolly-pixel/ui/elements/dialog";
import { Search } from "@jolly-pixel/ui/elements/search";
import { Tree } from "@jolly-pixel/ui/elements/tree";

// Import Internal Dependencies
import {
  AssetChoices,
  type AssetChoiceNode,
  type AssetChoicesCatalog
} from "./AssetChoices.ts";

// CONSTANTS
const kPickAction = "pick";
const kTreeStyle = {
  height: "min(320px, 50vh)",
  overflow: "auto"
};

export interface AssetPickOptions {
  kinds: Iterable<AssetKindDescriptor>;
  title: string;
  current?: AssetReferenceData | null;
  /**
   * Narrows the assets of `kinds` the picker offers.
   */
  accepts?: (reference: AssetReferenceData) => boolean;
}

export function pickAsset(
  options: AssetPickOptions,
  catalog: AssetChoicesCatalog,
  signal: AbortSignal
): Promise<AssetReferenceData | null> {
  if (signal.aborted) {
    return Promise.resolve(null);
  }

  const choices = new AssetChoices({
    catalog,
    kinds: options.kinds,
    current: options.current,
    accepts: options.accepts
  });

  const dialog = new Dialog();
  dialog.heading = options.title;

  const tree = new Tree<AssetReferenceData>();
  tree.activateOnDoubleClick = true;
  for (const [property, value] of Object.entries(kTreeStyle)) {
    tree.style.setProperty(property, value);
  }
  tree.addEventListener("jolly-select", (event) => {
    choices.select(event.detail.selected);
  });
  tree.addEventListener("jolly-toggle-expand", (event) => {
    choices.toggle(event.detail.id, event.detail.expanded);
  });
  tree.addEventListener("jolly-activate", (event) => {
    if (choices.activate(event.detail.id) !== null) {
      dialog.close(kPickAction);
    }
  });

  const search = new Search();
  search.label = "Search assets";
  search.placeholder = "Search";
  search.addEventListener("jolly-input", (event) => {
    const detail = readDetail<JollyChangeDetail<string>>(event);
    if (detail !== null) {
      tree.filter = detail.value;
    }
  });

  const empty = document.createElement("p");
  empty.textContent = "No asset to pick.";

  const cancel = actionButton("Cancel", "default");
  cancel.addEventListener("click", () => dialog.close());
  const pick = actionButton("Pick", "accent");
  pick.addEventListener("click", () => dialog.close(kPickAction));

  let shownNodes: readonly AssetChoiceNode[] | null = null;
  function render(): void {
    if (choices.nodes !== shownNodes) {
      shownNodes = choices.nodes;
      tree.nodes = [...shownNodes];
    }
    tree.expanded = choices.expanded;
    tree.selected = choices.selected;
    tree.hidden = choices.nodes.length === 0;
    empty.hidden = choices.nodes.length > 0;
    pick.disabled = choices.chosen === null;
  }
  render();
  choices.on("change", render);

  function onAbort(): void {
    dialog.close();
  }
  signal.addEventListener("abort", onAbort, {
    once: true
  });

  const {
    promise,
    resolve
  } = Promise.withResolvers<AssetReferenceData | null>();
  dialog.addEventListener("jolly-close", (event) => {
    const detail = readDetail<{ returnValue: string; }>(event);
    signal.removeEventListener("abort", onAbort);
    choices.off("change", render);
    choices.dispose();
    resolve(detail?.returnValue === kPickAction ? choices.chosen : null);
  }, {
    once: true
  });
  dialog.addEventListener("jolly-exited", () => dialog.remove(), {
    once: true
  });

  dialog.append(search, tree, empty, cancel, pick);
  document.body.append(dialog);
  void dialog.showModal().then(() => {
    if (signal.aborted) {
      dialog.close();
    }
    else {
      search.focus();
    }
  });

  return promise;
}

function actionButton(
  label: string,
  variant: Button["variant"]
): Button {
  const button = new Button();
  button.slot = "actions";
  button.variant = variant;
  button.textContent = label;

  return button;
}
