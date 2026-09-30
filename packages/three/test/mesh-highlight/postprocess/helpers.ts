// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  MeshHighlightState,
  PeerHighlightPass,
  PeerHoverRegistry,
  PeerSelectionRegistry,
  PeerSelectionVisibility,
  type HighlightEntry
} from "#src/index.ts";
import {
  createFrontCamera,
  createPeerScene
} from "../peer/helpers.ts";

export interface HighlightSpy {
  entries: HighlightEntry[];
  calls: HighlightEntry[][];
}

export interface PeerHighlightHarness {
  selection: MeshHighlightState;
  registry: PeerSelectionRegistry;
  hoverRegistry: PeerHoverRegistry | undefined;
  highlight: HighlightSpy;
  peerHighlight: PeerHighlightPass;
  visibility: PeerSelectionVisibility | undefined;
  mesh: THREE.Mesh;
}

export function createRendererStub(): THREE.WebGPURenderer {
  return {
    toneMapping: THREE.NoToneMapping,
    outputColorSpace: THREE.SRGBColorSpace
  } as unknown as THREE.WebGPURenderer;
}

export function createMesh(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
}

export function createInstancedMesh(): THREE.InstancedMesh {
  return new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
    10
  );
}

export function createEntriesOfEveryShape(): HighlightEntry[] {
  const group = new THREE.Group();
  group.add(createMesh());
  group.add(createMesh());

  return [
    {
      target: createMesh(),
      color: "#ff0000"
    },
    {
      target: group,
      color: "#00ff00",
      priority: true
    },
    {
      target: createMesh(),
      color: "#0000ff",
      isolated: true
    },
    {
      target: createInstancedMesh(),
      instanceId: 3,
      color: "#ffffff",
      priority: true
    }
  ];
}

export function createHighlightSpy(): HighlightSpy {
  const calls: HighlightEntry[][] = [];

  return {
    set entries(entries: HighlightEntry[]) {
      calls.push(entries);
    },
    get entries(): HighlightEntry[] {
      return calls.at(-1) ?? [];
    },
    calls
  };
}

export function createPeerHighlightHarness(
  options?: { visibility?: boolean; hover?: boolean; }
): PeerHighlightHarness {
  const { selection, registry, mesh } = createPeerScene();
  const hoverRegistry = options?.hover ? new PeerHoverRegistry() : undefined;
  const highlight = createHighlightSpy();

  const visibility = options?.visibility ?
    new PeerSelectionVisibility({
      registry,
      selection,
      camera: createFrontCamera(),
      hoverRegistry
    }) :
    undefined;

  const peerHighlight = new PeerHighlightPass({
    registry,
    selection,
    highlight,
    visibility,
    hoverRegistry
  });

  return {
    selection,
    registry,
    hoverRegistry,
    highlight,
    peerHighlight,
    visibility,
    mesh
  };
}

export function lastEntries(
  spy: HighlightSpy
): HighlightEntry[] {
  return spy.calls.at(-1) ?? [];
}
