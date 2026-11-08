// Import Internal Dependencies
import type { WorldAudio } from "./World.ts";
import type { RenderComponent } from "./rendering/Renderer.ts";
import type {
  ActorNode,
  SceneGraph
} from "./scene/SceneGraph.ts";

export interface SceneBackend {}

type Registered<TKey extends string, TDefault> =
  SceneBackend extends Record<TKey, infer TValue> ? TValue : TDefault;

export type BackendActorNode = Registered<"node", ActorNode>;
export type BackendSceneGraph = Registered<"graph", SceneGraph>;
export type BackendAudio = Registered<"audio", WorldAudio>;
export type BackendRenderComponent = Registered<"renderComponent", RenderComponent>;
