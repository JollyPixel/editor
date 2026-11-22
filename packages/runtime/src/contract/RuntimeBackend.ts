// Import Third-party Dependencies
import type {
  AssetCoordinator,
  AssetRecord
} from "@jolly-pixel/asset";
import type {
  FrameSchedule,
  FrameSource
} from "@jolly-pixel/loop";
import type { MetricSource } from "@jolly-pixel/ui/stats";

export interface MetricsPanelKeyboard {
  on(
    type: string,
    handler: (event: KeyboardEvent) => void
  ): unknown;
  off(
    type: string,
    handler: (event: KeyboardEvent) => void
  ): void;
}

export interface GamepadPoller {
  readonly connectedGamepads: number;
  readonly wasActive: boolean;
  sample(): void;
}

export interface RuntimeInput {
  readonly wasActive: boolean;
  readonly keyboard: MetricsPanelKeyboard;
  readonly gamepad: GamepadPoller;
}

export interface RuntimeWorld {
  readonly animating: boolean;
  readonly input: RuntimeInput;
  readonly assetCoordinator: AssetCoordinator;

  tick(
    schedule: FrameSchedule
  ): boolean;
  invalidate(): void;
  on(
    type: "invalidate",
    handler: () => void
  ): unknown;
  once(
    type: "afterUpdate",
    handler: () => void
  ): unknown;
}

export interface RuntimeSceneProgress {
  readonly completed: number;
  readonly total: number;
  readonly currentAsset: AssetRecord | null;
}

export interface RuntimeBackend<
  TWorld extends RuntimeWorld = RuntimeWorld,
  TScene = unknown,
  TMetrics extends MetricSource = MetricSource
> {
  readonly world: TWorld;
  readonly frameSource: FrameSource;
  readonly metrics: TMetrics;

  adaptPixelRatio(
    ratio: number
  ): void;
  loadScene(
    scene: TScene,
    onProgress: (progress: RuntimeSceneProgress) => void
  ): Promise<void>;
  start(): void;
  stop(): void;
  dispose(): void;
}
