// Import Internal Dependencies
import type {
  FieldValue,
  MixedSymbol
} from "../field/mixed.ts";

export interface Vec2Like {
  readonly x: number;
  readonly y: number;
}

export interface Vec3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface QuatLike {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

export interface TransformLike {
  readonly position: Vec3Like;
  readonly rotation: QuatLike;
  readonly scale: Vec3Like;
}

/**
 * Vector value with whole-value or per-axis Mixed state for multi-selection.
 */
export type VectorValue<TAxis extends string> =
  | Record<TAxis, number>
  | Record<TAxis, FieldValue<number>>
  | MixedSymbol;
