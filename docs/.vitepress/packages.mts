export interface DocumentedPackage {
  dir: string;
  text: string;
}

export interface PackageGroup {
  text: string;
  packages: DocumentedPackage[];
}

export const packageGroups: PackageGroup[] = [
  {
    text: "Engine",
    packages: [
      { dir: "engine", text: "Engine" },
      { dir: "runtime", text: "Runtime" },
      { dir: "loop", text: "Loop" },
      { dir: "controls", text: "Controls" }
    ]
  },
  {
    text: "Rendering",
    packages: [
      { dir: "three", text: "Three" },
      { dir: "voxel-renderer", text: "Voxel Renderer" },
      { dir: "pixel-draw-renderer", text: "Pixel Draw" },
      { dir: "color", text: "Color" },
      { dir: "image", text: "Image" }
    ]
  },
  {
    text: "Assets",
    packages: [
      { dir: "asset", text: "Asset" },
      { dir: "asset-source", text: "Asset Source" },
      { dir: "asset-server", text: "Asset Server" },
      { dir: "event-store", text: "Event Store" }
    ]
  },
  {
    text: "Collaboration",
    packages: [
      { dir: "network", text: "Network" }
    ]
  },
  {
    text: "Interface",
    packages: [
      { dir: "ui", text: "UI" },
      { dir: "resize-handle", text: "Resize Handle" },
      { dir: "arbor", text: "Arbor" }
    ]
  }
];

export const documentedPackages: DocumentedPackage[] = packageGroups
  .flatMap((group) => group.packages);
