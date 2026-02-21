// Import Third-party Dependencies
import {
  UIRenderer,
  UISprite
} from "@jolly-pixel/engine";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";

const canvasHTMLElement = document.querySelector("canvas") as HTMLCanvasElement;
const runtime = new Runtime(canvasHTMLElement, {
  includePerformanceStats: true
});
const { world } = runtime;

const camera2DActor = world.createActor("camera2D")
  .addComponent(UIRenderer, { near: 1 });

const uiButton = world.createActor("uiContainer", {
  parent: camera2DActor
})
  .addComponentAndGet(UISprite, {
    anchor: { y: "top" },
    offset: { y: -50 },
    size: { width: 200, height: 60 },
    style: {
      color: 0x0077ff
    },
    styleOnHover: {
      color: 0x0099ff
    },
    text: {
      textContent: "Click Me",
      style: {
        color: "#ffffff",
        fontSize: "20px",
        fontWeight: "bold"
      }
    }
  });

uiButton.onHover.connect(() => {
  console.log("Button hovered!");
});
uiButton.onClick.connect(() => {
  console.log("Button clicked!");
});

loadRuntime(runtime)
  .catch(console.error);
