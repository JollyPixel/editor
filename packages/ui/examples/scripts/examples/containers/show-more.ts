// Import Internal Dependencies
import "../../../../src/containers/folder/Folder.ts";
import "../../../../src/containers/pane/Pane.ts";
import "../../../../src/containers/show-more/ShowMore.ts";
import "../../../../src/controls/Button.ts";
import "../../../../src/controls/Text.ts";
import type { GalleryExample } from "../../types.ts";

// CONSTANTS
const kMeshFields = [
  "Geometry",
  "Width",
  "Height",
  "Depth",
  "Color",
  "Roughness",
  "Metalness",
  "Emissive",
  "Opacity",
  "Flat shading",
  "Cast shadow",
  "Receive shadow"
];
const kLightFields = [
  "Kind",
  "Color",
  "Intensity",
  "Distance",
  "Decay",
  "Cast shadow"
];

interface ShowMoreFolder {
  folder: HTMLElementTagNameMap["jolly-folder"];
  showMore: HTMLElementTagNameMap["jolly-show-more"];
}

export const SHOW_MORE_EXAMPLE: GalleryExample = {
  render(host) {
    const pane = document.createElement("jolly-pane");
    pane.heading = "Inspector";
    pane.searchable = true;
    pane.style.maxWidth = "320px";

    const mesh = folder("Mesh renderer", kMeshFields);
    mesh.showMore.storageKey = "gallery-show-more:mesh";
    mesh.folder.append(addRow(mesh.showMore));

    pane.append(
      mesh.folder,
      folder("Light", kLightFields).folder
    );
    host.append(pane);
  }
};

function folder(
  label: string,
  fields: readonly string[]
): ShowMoreFolder {
  const element = document.createElement("jolly-folder");
  element.label = label;
  element.dataset.folder = label;

  const showMore = document.createElement("jolly-show-more");
  showMore.append(...fields.map(field));
  element.append(showMore);

  return {
    folder: element,
    showMore
  };
}

function field(
  label: string
): HTMLElementTagNameMap["jolly-text"] {
  const element = document.createElement("jolly-text");
  element.label = label;
  element.dataset.field = label;
  element.value = "";

  return element;
}

function addRow(
  showMore: HTMLElementTagNameMap["jolly-show-more"]
): HTMLElementTagNameMap["jolly-button"] {
  const button = document.createElement("jolly-button");
  button.slot = "actions";
  button.icon = "plus";
  button.iconOnly = true;
  button.label = "Add row";
  button.title = "Add row";
  button.addEventListener("click", () => {
    showMore.append(field(`Extra ${showMore.children.length + 1}`));
  });

  return button;
}
