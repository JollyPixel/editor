// Import Internal Dependencies
import type {
  ModelAnimationLinks,
  ModelAnimationLinksReader
} from "../animation/ModelAnimationLinks.ts";
import type {
  ModelMaterials,
  ModelMaterialsReader
} from "../materials/ModelMaterials.ts";
import type {
  ModelNodes,
  ModelNodesReader
} from "../nodes/ModelNodes.ts";

export interface ModelCollections {
  readonly nodes: ModelNodesReader;
  readonly materials: ModelMaterialsReader;
  readonly animationSets: ModelAnimationLinksReader;
}

export interface ModelStores {
  readonly nodes: ModelNodes;
  readonly materials: ModelMaterials;
  readonly animationSets: ModelAnimationLinks;
}
