// Import Third-party Dependencies
import type { AnchorRect } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { TargetPath } from "./TargetPath.ts";

export type StepSide = "above" | "below" | "left" | "right";

export interface StepImage {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface StepContext {
  page: Document;
  signal: AbortSignal;
}

export type StepCleanup = () => void;

export type StepEnter = (
  context: StepContext
) => void | StepCleanup | Promise<void | StepCleanup>;

export type StepUntil = (
  context: StepContext
) => Promise<void>;

export type StepWhen = (
  context: Pick<StepContext, "page">
) => boolean;

export type TargetLocator = () => Element | AnchorRect | null;

export type StepTarget = TargetPath | TargetLocator;

export interface TourStepOptions {
  id: string;
  title: string;
  body: string;
  image?: StepImage;
  target?: readonly string[] | TargetLocator;
  /**
   * @default "below"
   */
  side?: StepSide;
  when?: StepWhen;
  enter?: StepEnter;
  until?: StepUntil;
}

export interface TourStep {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly image: Readonly<StepImage> | null;
  readonly target: StepTarget | null;
  readonly side: StepSide;
  readonly when: StepWhen | null;
  readonly enter: StepEnter | null;
  readonly until: StepUntil | null;
}
