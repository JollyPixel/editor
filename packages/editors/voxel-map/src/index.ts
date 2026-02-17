// Import Third-party Dependencies
import {
  Actor,
  Camera3DControls
} from "@jolly-pixel/engine";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import { TreeView } from "@jolly-pixel/fs-tree/tree-view";

// Import Internal Dependencies
import { VoxelRenderer } from "./VoxelRenderer.ts";
import { CubeSelectorRenderer } from "./CubeSelectorRenderer.ts";

const runtime = initRuntime();
initTreeView();
initCubeSelector();

loadRuntime(runtime)
  .catch(console.error);

function initRuntime() {
  const canvasHTMLElement = document.querySelector("#game-container > canvas") as HTMLCanvasElement;
  const runtime = new Runtime(canvasHTMLElement, {
    includePerformanceStats: true
  });
  const { world } = runtime;

  new Actor(world, { name: "camera" })
    .addComponent(Camera3DControls, { speed: 8, rotationSpeed: 1 }, (component) => {
      component.camera.position.set(200, 200, 400);
      component.camera.lookAt(0, 0, 0);
    });

  new Actor(world, { name: "map" })
    .addComponent(VoxelRenderer, { ratio: 16, cameraActorName: "camera" });

  return runtime;
}

function initTreeView() {
  const treeViewContainer = document.querySelector("#layer-box > .box-content") as HTMLDivElement;
  const treeView = new TreeView(treeViewContainer);
  treeView.append(createItem("Default"), "item");

  function createItem(label: string): HTMLLIElement {
    const itemElt = document.createElement("li");

    const iconElt = document.createElement("i");
    iconElt.classList.add("icon");
    itemElt.appendChild(iconElt);

    const spanElt = document.createElement("span");
    spanElt.textContent = label;
    itemElt.appendChild(spanElt);

    return itemElt;
  }
}

function initCubeSelector() {
  new CubeSelectorRenderer(
    document.querySelector("#cube-box > .box-content") as HTMLElement,
    {
      width: 400,
      height: 250
    }
  );
}
