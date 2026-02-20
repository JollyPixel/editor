// Import Third-party Dependencies
import {
  Actor,
  Camera3DControls,
  AudioBackground,
  GlobalAudioManager,
  TextRenderer,
  createViewHelper
} from "@jolly-pixel/engine";
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";
import * as THREE from "three";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// Import Internal Dependencies
// import { SpriteRenderer } from "./components/sprite/SpriteRenderer.class.ts";

const canvasHTMLElement = document.querySelector("canvas") as HTMLCanvasElement;
const runtime = new Runtime(canvasHTMLElement, {
  includePerformanceStats: true
});
const { world } = runtime;
world.renderer.setRenderMode("composer");

new Actor(world, { name: "camera" })
  .addComponent(Camera3DControls, { speed: 0.35, rotationSpeed: 0.45 }, (component) => {
    component.camera.position.set(10, 10, 5);
    component.camera.lookAt(0, 0, 0);

    world.renderer.setEffects(
      new UnrealBloomPass(world.input.getScreenSize(), 0.35, 0, 0.15),
      new OutputPass()
    );

    createViewHelper(component.camera, world);
  });

// new Actor(world, { name: "sprite" })
//   .addComponent(SpriteRenderer, {
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

new Actor(world, { name: "tilemap" });
// .addComponent(TiledMapRenderer, {
//   assetPath: "./assets/tilemaps/experimental_map.tmj",
//   orientation: "top-down"
// });

const textActor = new Actor(world, { name: "3d-text" })
  .addComponent(TextRenderer, {
    path: "./assets/fonts/helvetiker_regular.typeface.json",
    text: "Hello, 3D World !",
    textGeometryOptions: { size: 2, depth: 2, center: true }
  });
textActor.object3D.position.set(0, 5, 0);

const scene = world.sceneManager.getSource();
scene.background = new THREE.Color("#000000");
scene.add(
  new THREE.GridHelper(
    50,
    50,
    new THREE.Color("#888888")
  ),
  new THREE.AmbientLight(new THREE.Color("#ffffffff"), 3)
);

const audioManager = GlobalAudioManager.fromWorld(world);

const ab = new AudioBackground({
  audioManager,
  playlists: [
    {
      name: "normal",
      onEnd: "loop",
      tracks: [
        {
          name: "behemoth",
          path: "./assets/sounds/behemoth.ogg"
        },
        {
          name: "infernal-heat",
          path: "./assets/sounds/infernal-heat.ogg"
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
          path: "./assets/sounds/tech-space.ogg",
          volume: 0.5
        }
      ]
    }
  ]
});
world.audio.observe(ab);

canvasHTMLElement.addEventListener("click", async() => {
  await ab.play("boss.tech-space");
});

loadRuntime(runtime)
  .catch(console.error);
