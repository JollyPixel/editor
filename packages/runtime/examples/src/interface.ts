// Import Third-party Dependencies
import {
  UIRenderer,
  UISprite,
  Systems
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import { bootstrapRuntime } from "./utils/bootstrapRuntime.ts";

/**
 * Declares and constructs the GUI example scene.
 */
class InterfaceScene extends Systems.Scene {
  constructor() {
    super("interface");
  }

  override awake(): void {
    const camera2DActor = this.world.createActor("camera2D")
      .addComponent(UIRenderer, { near: 1 });

    const uiButton = this.world.createActor("uiContainer", {
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
  }
}

await bootstrapRuntime({
  includePerformanceStats: true,
  scene: new InterfaceScene()
});
