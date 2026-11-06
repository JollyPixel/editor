export interface SceneActorCategoryInfo {
  readonly id: string;
  readonly label: string;
}

// CONSTANTS
export const SCENE_ACTOR_CATEGORIES = [
  {
    id: "camera",
    label: "Camera"
  },
  {
    id: "light",
    label: "Light"
  },
  {
    id: "3d",
    label: "3D"
  },
  {
    id: "2d",
    label: "2D"
  },
  {
    id: "audio",
    label: "Audio"
  },
  {
    id: "logic",
    label: "Logic"
  },
  {
    id: "ui",
    label: "UI"
  }
] as const satisfies readonly SceneActorCategoryInfo[];

export type SceneActorCategory = typeof SCENE_ACTOR_CATEGORIES[number]["id"];
