// Import Third-party Dependencies
import * as THREE from "three";
import { Systems, UIRenderer, UISprite, UIText } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { LOGO_SVG } from "../assets/logo.ts";
import type { SplashScreen } from "./SplashScreen.ts";

// CONSTANTS
const kFadeDurationSec = 0.6;
const kProgressBarWidth = 400;
const kProgressBarHalfWidth = kProgressBarWidth / 2;
const kProgressBarHeight = 8;
const kBackgroundSize = 9999;
// The SVG viewBox is 252×252 (square); keep the sprite square to avoid distortion.
const kLogoSize = 140;
const kLogoCanvasSize = 256;
const kLogoOffsetY = 80;
const kProgressOffsetY = -30;
const kAssetLabelOffsetY = -48;
const kClickPromptOffsetY = -60;

type SplashState = "LOADING" | "READY" | "FADING_OUT" | "COMPLETE" | "ERROR";

export class DefaultSplashScreen extends Systems.Scene<any> implements SplashScreen {
  readonly scene: Systems.Scene<any> = this;

  #uiRenderer!: UIRenderer<any>;
  #bgSprite!: UISprite<any>;
  #logoSprite!: UISprite<any>;
  #trackSprite!: UISprite<any>;
  #fillSprite!: UISprite<any>;
  #assetSprite!: UISprite<any>;
  #assetText!: UIText<any>;
  #promptSprite!: UISprite<any>;
  #promptText!: UIText<any>;
  #errorSprite!: UISprite<any>;
  #errorMsgText!: UIText<any>;
  #errorStackText!: UIText<any>;

  #state: SplashState = "LOADING";
  #fadeElapsed = 0;

  #allSprites: UISprite<any>[] = [];
  #allTexts: UIText<any>[] = [];

  #completeResolve?: () => void;
  readonly #completePromise = new Promise<void>((resolve) => {
    this.#completeResolve = resolve;
  });

  constructor() {
    super("DefaultSplashScreen");
  }

  override awake(): void {
    const { world } = this;

    const uiRootActor = world.createActor("SplashUIRoot");
    this.#uiRenderer = uiRootActor.addComponentAndGet(UIRenderer);

    const bgActor = world.createActor("SplashBackground");
    this.#bgSprite = bgActor.addComponentAndGet(UISprite, {
      size: { width: kBackgroundSize, height: kBackgroundSize },
      anchor: { x: "center", y: "center" },
      style: { color: new THREE.Color("#FFF") }
    });

    const logoActor = world.createActor("SplashLogo");
    this.#logoSprite = logoActor.addComponentAndGet(UISprite, {
      size: { width: kLogoSize, height: kLogoSize },
      anchor: { x: "center", y: "center" },
      offset: { y: kLogoOffsetY },
      style: { opacity: 0 }
    });

    const trackActor = world.createActor("SplashProgressTrack");
    this.#trackSprite = trackActor.addComponentAndGet(UISprite, {
      size: { width: kProgressBarWidth, height: kProgressBarHeight },
      anchor: { x: "center", y: "center" },
      offset: { y: kProgressOffsetY },
      style: { color: 0x333344 }
    });

    const fillActor = world.createActor("SplashProgressFill");
    this.#fillSprite = fillActor.addComponentAndGet(UISprite, {
      size: { width: kProgressBarWidth, height: kProgressBarHeight },
      anchor: { x: "center", y: "center" },
      offset: { y: kProgressOffsetY },
      style: { color: 0x4a8fd8 }
    });

    const assetActor = world.createActor("SplashAssetLabel");
    this.#assetSprite = assetActor.addComponentAndGet(UISprite, {
      size: { width: kProgressBarWidth, height: 20 },
      anchor: { x: "center", y: "center" },
      offset: { y: kAssetLabelOffsetY },
      style: { opacity: 0 }
    });
    this.#assetText = new UIText(this.#assetSprite, {
      textContent: "Loading runtime\u2026",
      style: {
        fontSize: "11px",
        color: "#aaaacc",
        textAlign: "center",
        opacity: "1"
      }
    });
    this.#allTexts.push(this.#assetText);

    const promptActor = world.createActor("SplashClickPrompt");
    this.#promptSprite = promptActor.addComponentAndGet(UISprite, {
      size: { width: kProgressBarWidth, height: 30 },
      anchor: { x: "center", y: "center" },
      offset: { y: kClickPromptOffsetY },
      style: { opacity: 0 }
    });
    this.#promptText = new UIText(this.#promptSprite, {
      textContent: "Click anywhere to start",
      style: {
        fontSize: "16px",
        color: "#ffffff",
        textAlign: "center",
        opacity: "0"
      }
    });
    this.#allTexts.push(this.#promptText);

    const errorActor = world.createActor("SplashErrorPanel");
    this.#errorSprite = errorActor.addComponentAndGet(UISprite, {
      size: { width: 500, height: 200 },
      anchor: { x: "center", y: "center" },
      style: { color: 0x1c0a00, opacity: 0 }
    });
    this.#errorMsgText = new UIText(this.#errorSprite, {
      textContent: "",
      style: {
        fontSize: "13px",
        color: "#ef5350",
        textAlign: "center",
        whiteSpace: "normal",
        opacity: "0"
      }
    });
    this.#errorStackText = new UIText(this.#errorSprite, {
      textContent: "",
      style: {
        fontSize: "10px",
        color: "#90a4ae",
        textAlign: "left",
        whiteSpace: "pre-wrap",
        opacity: "0"
      }
    });
    this.#allTexts.push(this.#errorMsgText, this.#errorStackText);
  }

  override start(): void {
    this.#allSprites.push(
      this.#bgSprite,
      this.#logoSprite,
      this.#trackSprite,
      this.#fillSprite,
      this.#assetSprite,
      this.#promptSprite,
      this.#errorSprite
    );
    this.#promptSprite.mesh.visible = false;
    this.#errorSprite.mesh.visible = false;
    this.#fillSprite.mesh.scale.x = 0.001;
    this.#fillSprite.mesh.position.x = -kProgressBarHalfWidth;
  }

  override update(
    deltaTime: number
  ): void {
    if (this.#state !== "FADING_OUT") {
      return;
    }

    this.#fadeElapsed += deltaTime;
    const alpha = Math.max(0, 1 - (this.#fadeElapsed / kFadeDurationSec));
    this.#applyAlpha(alpha);

    if (alpha <= 0) {
      this.#state = "COMPLETE";
      this.#completeResolve?.();
    }
  }

  override destroy(): void {
    this.#uiRenderer.clear();
    for (const text of this.#allTexts) {
      text.destroy();
    }
  }

  onSetup(): void {
    // Rasterise the inline SVG to an offscreen canvas so Three.js gets a
    // reliable bitmap texture regardless of browser SVG-in-WebGL quirks.
    const img = new Image();
    img.onload = () => {
      if (this.#state === "COMPLETE" || this.#state === "ERROR") {
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = kLogoCanvasSize;
      canvas.height = kLogoCanvasSize;
      canvas.getContext("2d")?.drawImage(img, 0, 0, kLogoCanvasSize, kLogoCanvasSize);

      const mat = this.#logoSprite.mesh.material as THREE.MeshBasicMaterial;
      mat.map = new THREE.CanvasTexture(canvas);
      mat.opacity = 1;
      mat.needsUpdate = true;
      this.#logoSprite.mesh.visible = true;
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(LOGO_SVG)}`;
  }

  onProgress(
    loaded: number,
    total: number
  ): void {
    if (this.#state === "ERROR") {
      return;
    }

    const progress = total > 0 ? Math.min(loaded / total, 1) : 0;
    this.#fillSprite.mesh.scale.x = Math.max(0.001, progress);

    // Shift the mesh left so its left edge stays aligned with the track's left edge.
    this.#fillSprite.mesh.position.x = (progress - 1) * kProgressBarHalfWidth;
  }

  onAssetStart(
    asset: Systems.Asset
  ): void {
    if (this.#state === "ERROR") {
      return;
    }
    this.#assetText.text = asset.toString();
  }

  onError(
    error: Error
  ): void {
    this.#state = "ERROR";

    this.#trackSprite.mesh.visible = false;
    this.#fillSprite.mesh.visible = false;
    this.#assetText.element.style.display = "none";
    this.#promptText.element.style.display = "none";

    this.#errorSprite.mesh.visible = true;
    const errorMat = this.#errorSprite.mesh.material as THREE.MeshBasicMaterial;
    errorMat.opacity = 1;

    this.#errorMsgText.text = error.message || "An error occurred";
    this.#errorMsgText.element.style.opacity = "1";

    const cause = (error.cause as Error | undefined);
    this.#errorStackText.text = cause?.stack ?? error.stack ?? "";
    this.#errorStackText.element.style.opacity = "1";
  }

  onLoadComplete(): void {
    if (this.#state !== "LOADING") {
      return;
    }
    this.#state = "READY";

    // Fill to 100 %
    this.#fillSprite.mesh.scale.x = 1;
    this.#fillSprite.mesh.position.x = 0;

    // Hide progress UI
    this.#trackSprite.mesh.visible = false;
    this.#fillSprite.mesh.visible = false;
    this.#assetText.element.style.display = "none";

    // Show click prompt
    this.#promptSprite.mesh.visible = true;
    this.#promptText.element.style.opacity = "1";
    this.#promptText.element.style.display = "block";
  }

  async waitForUserGesture(): Promise<void> {
    return new Promise<void>((resolve) => {
      let resolved = false;

      const onGesture = () => {
        if (resolved) {
          return;
        }
        resolved = true;
        this.#bgSprite.onClick.disconnect(onGesture);
        window.removeEventListener("keydown", onGesture);
        resolve();
      };

      this.#bgSprite.onClick.connect(onGesture);
      window.addEventListener("keydown", onGesture);
    });
  }

  async complete(): Promise<void> {
    this.#state = "FADING_OUT";
    await this.#completePromise;

    this.world.sceneManager.removeScene(this);
  }

  #applyAlpha(
    alpha: number
  ): void {
    for (const sprite of this.#allSprites) {
      if (sprite.mesh.visible) {
        (sprite.mesh.material as THREE.MeshBasicMaterial).opacity = alpha;
      }
    }

    for (const text of this.#allTexts) {
      if (text.element.style.display !== "none") {
        text.element.style.opacity = String(alpha);
      }
    }
  }
}
