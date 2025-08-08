// Import Third-party Dependencies
import {
  Systems,
  Actor,
  Components,
  AudioBackground
} from "@jolly-pixel/engine";
import * as THREE from "three";

// Import Internal Dependencies
import { SpriteRenderer } from "./components/SpriteRenderer.class.js";

const canvasHTMLElement = document.querySelector("canvas") as HTMLCanvasElement;
const runtime = new Systems.Runtime(canvasHTMLElement, {
  includePerformanceStats: true
});
const { gameInstance } = runtime;

new Actor(gameInstance, { name: "camera" })
  .registerComponent(Components.Camera3DControls, { speed: 0.35, rotationSpeed: 0.45 }, (component) => {
    component.camera.position.set(10, 10, 5);
    component.camera.lookAt(0, 0, 0);
  });

new Actor(gameInstance, { name: "sprite" })
  .registerComponent(SpriteRenderer, {
    texture: "./assets/sprites/teleport-door.png",
    tileHorizontal: 16,
    tileVertical: 1,
    animations: {
      open: { from: 0, to: 15 }
    }
  }, (sprite) => {
    sprite.setHorizontalFlip(true);
    sprite.animation.play("open", { loop: true, duration: 2.5 });
  });

gameInstance.threeScene.background = null;
gameInstance.threeScene.add(
  // new THREE.GridHelper(
  //   50,
  //   10,
  //   new THREE.Color("#888888")
  // ),
  new THREE.AmbientLight(new THREE.Color("#ffffff"), 1)
);

const ab = new AudioBackground(gameInstance, {
  playlists: [
    {
      name: "default",
      onEnd: "loop",
      tracks: [
        {
          name: "behemoth",
          assetPath: "./assets/sounds/behemoth.ogg"
        },
        {
          name: "infernal-heat",
          assetPath: "./assets/sounds/infernal-heat.ogg"
        }
      ]
    },
    {
      name: "second",
      onEnd: "play-next-playlist",
      nextPlaylistName: "default",
      tracks: [
        {
          name: "tech-space",
          assetPath: "./assets/sounds/tech-space.ogg",
          volume: 1
        }
      ]
    }
  ]
});

runtime.start();

canvasHTMLElement.addEventListener("click", async() => {
  await ab.preload();
  await ab.play("second.tech-space");
});
