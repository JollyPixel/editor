// Import Third-party Dependencies
import {
  Camera3DControls,
  AudioBackground,
  GlobalAudioManager,
  TextRenderer,
  createViewHelper,
  AssetTypes,
  Systems
} from "@jolly-pixel/engine";
import { AssetReference } from "@jolly-pixel/asset";
import * as THREE from "three";

// Import Internal Dependencies
import { bootstrapRuntime } from "./utils/bootstrapRuntime.ts";

// CONSTANTS
const kHelvetikerRegularFont = new AssetReference("helvetiker_regular", AssetTypes.font);

/**
 * Declares and constructs the renderers example scene.
 */
class RenderersScene extends Systems.Scene {
  audioBackground!: AudioBackground;

  constructor() {
    super("renderers", {
      assets: [kHelvetikerRegularFont]
    });
  }

  override awake(): void {
    const scene = this.world.sceneManager.getSource();
    scene.background = new THREE.Color("#000000");
    scene.add(
      new THREE.GridHelper(
        50,
        50,
        new THREE.Color("#888888")
      ),
      new THREE.AmbientLight(new THREE.Color("#ffffffff"), 3)
    );

    this.world.createActor("camera")
      .addComponent(Camera3DControls, {}, (component) => {
        component.actor.transform
          .setLocalPosition({ x: 10, y: 10, z: 5 })
          .lookAt({ x: 0, y: 0, z: 0 });

        createViewHelper(component.camera, this.world);
      });

    const textActor = this.world.createActor("text")
      .addComponent(TextRenderer, {
        asset: kHelvetikerRegularFont,
        text: "Hello, 3D World !",
        textGeometryOptions: { size: 2, depth: 2, center: true }
      });
    textActor.object3D.position.set(0, 5, 0);

    const audioManager = GlobalAudioManager.fromWorld(this.world);
    this.audioBackground = new AudioBackground({
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
    this.world.audio.observe(this.audioBackground);
  }
}

const renderersScene = new RenderersScene();
const runtime = await bootstrapRuntime({
  includePerformanceStats: true,
  assets: {
    catalog: "./assets.json"
  },
  scene: renderersScene
});

runtime.canvas.addEventListener("click", async() => {
  await renderersScene.audioBackground.play("boss.tech-space");
}, { once: true });
