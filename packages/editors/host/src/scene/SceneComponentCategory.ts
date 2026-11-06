export interface SceneComponentCategoryInfo {
  readonly id: string;
  readonly label: string;
}

// CONSTANTS
export const SCENE_COMPONENT_CATEGORIES = [
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
    id: "physics",
    label: "Physics"
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
] as const satisfies readonly SceneComponentCategoryInfo[];

export type SceneComponentCategory = typeof SCENE_COMPONENT_CATEGORIES[number]["id"];
