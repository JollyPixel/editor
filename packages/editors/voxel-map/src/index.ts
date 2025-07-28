// Import Third-party Dependencies
import {
  Systems,
  Actor,
  Components
} from "@jolly-pixel/engine";
import { TreeView } from "@jolly-pixel/fs-tree/tree-view";

// Import Internal Dependencies
import { VoxelRenderer } from "./VoxelRenderer.js";
import { CubeSelectorRenderer } from "./CubeSelectorRenderer.js";

const runtime = initRuntime();
initTreeView();
initCubeSelector();
runtime.start();

function initRuntime() {
  const canvasHTMLElement = document.querySelector("#game-container > canvas") as HTMLCanvasElement;
  const runtime = new Systems.Runtime(canvasHTMLElement, {
    includePerformanceStats: true
  });
  const { gameInstance } = runtime;
  // gameInstance.setRatio(16 / 9);

  new Actor(gameInstance, { name: "camera" })
    .registerComponent(Components.Camera3DControls, { speed: 8, rotationSpeed: 1 }, (component) => {
      component.camera.position.set(200, 200, 400);
      component.camera.lookAt(0, 0, 0);
    });

  new Actor(gameInstance, { name: "map" })
    .registerComponent(VoxelRenderer, { ratio: 16, cameraActorName: "camera" });

  return runtime;
}

function initTreeView() {
  const treeViewContainer = document.querySelector("#layer-box > .box-content");
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
