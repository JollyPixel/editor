// Import Third-party Dependencies
import {
  Camera3DControls,
  AudioBackground,
  SoundAssetType,
  TextRenderer,
  AssetTypes,
  Systems
} from "@jolly-pixel/engine";
import { AssetReference } from "@jolly-pixel/asset";
import * as THREE from "three";

// Import Internal Dependencies
import { bootstrapRuntime } from "./utils/bootstrapRuntime.ts";

// CONSTANTS
const kHelvetikerRegularFont = new AssetReference("helvetiker_regular", AssetTypes.font);

class RenderersScene extends Systems.Scene {
  audioBackground!: AudioBackground;

  constructor() {
    super("renderers", {
      assets: [kHelvetikerRegularFont]
    });
  }

  override awake(): void {
    const scene = this.world.sceneManager.graph.scene;
    scene.background = new THREE.Color("#000000");
    scene.add(
      new THREE.GridHelper(
        50,
        50,
        new THREE.Color("#888888")
      ),
      new THREE.AmbientLight(new THREE.Color("#ffffffff"), 3)
    );

    const { transform } = this.world.createActor("camera")
      .addComponent(Camera3DControls);
    transform.local.position = { x: 10, y: 10, z: 5 };
    transform.lookAt({ x: 0, y: 0, z: 0 });

    const textActor = this.world.createActor("text")
      .addComponent(TextRenderer, {
        asset: kHelvetikerRegularFont,
        text: "Hello, 3D World !",
        size: 2,
        depth: 2
      });
    textActor.transform.local.position = { x: 0, y: 5, z: 0 };

    this.audioBackground = new AudioBackground({
      audio: this.world.audio,
      assets: this.world.assetCoordinator,
      crossfade: 1,
      playlists: [
        {
          name: "normal",
          onEnd: "loop",
          tracks: [
            {
              name: "behemoth",
              sound: new AssetReference("behemoth", SoundAssetType)
            },
            {
              name: "infernal-heat",
              sound: new AssetReference("infernal-heat", SoundAssetType)
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
              sound: new AssetReference("tech-space", SoundAssetType),
              volume: 0.5
            }
          ]
        }
      ]
    });
  }
}

const renderersScene = new RenderersScene();
const runtime = await bootstrapRuntime({
  includePerformanceStats: true,
  viewHelper: true,
  assets: {
    catalog: "./assets.json"
  },
  scene: renderersScene
});

runtime.canvas.addEventListener("click", async() => {
  await renderersScene.audioBackground.play("boss.tech-space");
}, { once: true });
