// Import Third-party Dependencies
import {
  Actor,
  UIRenderer,
  UISprite
} from "@jolly-pixel/engine";
import { Player, loadPlayer } from "@jolly-pixel/runtime";

const canvasHTMLElement = document.querySelector("canvas") as HTMLCanvasElement;
const runtime = new Player(canvasHTMLElement, {
  includePerformanceStats: true
});
const { gameInstance } = runtime;

const camera2DActor = new Actor(gameInstance, { name: "camera2D" })
  .registerComponent(UIRenderer, { near: 1 });

const uiButton = new Actor(gameInstance, {
  name: "uiContainer",
  parent: camera2DActor
})
  .registerComponentAndGet(UISprite, {
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

loadPlayer(runtime)
  .catch(console.error);
