// Import Third-party Dependencies
import {
  Actor
} from "@jolly-pixel/engine";
import { Player, loadPlayer } from "@jolly-pixel/runtime";
import * as THREE from "three";

// Import Internal Dependencies
import { ButtonBehavior } from "./ButtonBehavior.ts";

const canvasHTMLElement = document.querySelector("canvas") as HTMLCanvasElement;
const runtime = new Player(canvasHTMLElement, {
  includePerformanceStats: true
});
const { gameInstance } = runtime;

const camera2DActor = new Actor(gameInstance, { name: "camera2D" });

const screenBounds = gameInstance.input.getScreenBounds();

const camera = new THREE.OrthographicCamera(
  screenBounds.left,
  screenBounds.right,
  screenBounds.top,
  screenBounds.bottom,
  1
);
camera.position.z = 10;
gameInstance.renderer.addRenderComponent(camera);
camera2DActor.threeObject.add(camera);

const actorUIButton = new ButtonBehavior(camera2DActor, {
  x: 0,
  y: screenBounds.top - 50,
  width: 200,
  height: 60,
  text: "Click Me!",
  backgroundColor: 0x3498db,
  hoverColor: 0x2980b9
});
actorUIButton.on("metadataInitialized", () => {
  actorUIButton.onHover.connect(() => {
    console.log("Button hovered!");
  });
  actorUIButton.onClick.connect(() => {
    console.log("Button clicked!");
  });
});

loadPlayer(runtime)
  .catch(console.error);
