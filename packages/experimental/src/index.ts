// Import Third-party Dependencies
import {
  Actor,
  Components,
  AudioBackground
} from "@jolly-pixel/engine";
import { Player, loadPlayer } from "@jolly-pixel/runtime";
import * as THREE from "three";

// Import Internal Dependencies
import { TileMapRenderer } from "./components/tiled/TileMapRenderer.js";
// import { SpriteRenderer } from "./components/sprite/SpriteRenderer.class.js";

const canvasHTMLElement = document.querySelector("canvas") as HTMLCanvasElement;
const runtime = new Player(canvasHTMLElement, {
  includePerformanceStats: true
});
const { gameInstance } = runtime;

new Actor(gameInstance, { name: "camera" })
  .registerComponent(Components.Camera3DControls, { speed: 0.35, rotationSpeed: 0.45 }, (component) => {
    component.camera.position.set(10, 10, 5);
    component.camera.lookAt(0, 0, 0);
  });

// new Actor(gameInstance, { name: "sprite" })
//   .registerComponent(SpriteRenderer, {
//     texture: "./assets/sprites/teleport-door.png",
//     tileHorizontal: 16,
//     tileVertical: 1,
//     animations: {
//       open: { from: 0, to: 15 }
//     }
//   }, (sprite) => {
//     sprite.setHorizontalFlip(true);
//     sprite.animation.play("open", { loop: true, duration: 2.5 });
//   });

new Actor(gameInstance, { name: "tilemap" })
  .registerComponent(TileMapRenderer, {
    assetPath: "./assets/tilemaps/experimental_map.tmj"
  });

gameInstance.threeScene.background = new THREE.Color("#000000");
gameInstance.threeScene.add(
  // new THREE.GridHelper(
  //   50,
  //   10,
  //   new THREE.Color("#888888")
  // ),
  new THREE.AmbientLight(new THREE.Color("#ffffffff"), 3)
);

const ab = new AudioBackground(gameInstance, {
  playlists: [
    {
      name: "normal",
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
      name: "boss",
      onEnd: "play-next-playlist",
      nextPlaylistName: "normal",
      tracks: [
        {
          name: "tech-space",
          assetPath: "./assets/sounds/tech-space.ogg",
          volume: 0.5
        }
      ]
    }
  ]
});

canvasHTMLElement.addEventListener("click", async() => {
  await ab.preload();
  await ab.play("second.tech-space");
});

loadPlayer(runtime, { loadingDelay: 1500 })
  .catch(console.error);
