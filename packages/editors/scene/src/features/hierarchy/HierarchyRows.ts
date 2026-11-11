// Import Third-party Dependencies
import type {
  SceneActorView,
  SceneComponentView,
  SceneTreeReader
} from "@jolly-pixel/asset.scene/client";
import { Systems } from "@jolly-pixel/engine";
import {
  resolveReparentMoves,
  type PeerMarks,
  type JollyReparentDetail,
  type TreeNode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  EMPTY_ACTOR_ICON,
  type AssetNaming,
  type SceneComponents
} from "../../components/SceneComponents.ts";
import type { ActorMove } from "../../editing/SceneActions.ts";
import type { SceneLiveView } from "../../editing/SceneEditing.ts";
import {
  actorAnchor,
  actorAnchorKey,
  type ActorAnchor
} from "../../state/AnchorPicks.ts";
import type { ComponentFocus } from "../../state/SelectionStore.ts";

// CONSTANTS
export const PREFAB_ICON = "actor-prefab";
const kAnchorIcon = "actor-anchor";
const kMissingAnchor = "The anchor is gone from the asset; its actors sit at the parent's origin";
const kMissingComponent = "No package of this project provides this component. Its data is kept.";

type ActorAnchors = Pick<Systems.SceneAnchorsReader, "anchors">;
type LiveActors = ActorAnchors & Pick<SceneLiveView, "expandedActors">;
type RowComponents = Pick<
  SceneComponents,
  "find" | "icon" | "summary" | "missingAsset"
>;

export interface RowSources {
  marks: PeerMarks<string>;
  components: RowComponents;
  naming: AssetNaming;
  loadable: Systems.LoadableAssets;
  live: LiveActors;
}

export interface ComponentMove {
  id: string;
  beforeId?: string;
}

export type HierarchyDrop =
  | { kind: "actors"; moves: ActorMove[]; }
  | { kind: "component"; move: ComponentMove; };

interface ActorSection {
  components: TreeNode[];
  loose: TreeNode[];
  actors: TreeNode[];
  closed: boolean;
}

export class HierarchyRows {
  static readonly EMPTY = new HierarchyRows();

  static anchorRowId(
    row: ActorAnchor
  ): string {
    return `anchor:${actorAnchorKey(row)}`;
  }

  static componentRowId(
    componentId: string
  ): string {
    return `component:${componentId}`;
  }

  static read(
    tree: Pick<SceneTreeReader, "actorIds" | "actor" | "canContain">,
    sources: RowSources
  ): HierarchyRows {
    const rows = new HierarchyRows();
    for (const id of tree.actorIds()) {
      const actor = tree.actor(id);
      if (actor === undefined) {
        continue;
      }

      rows.#add(actor, !tree.canContain(id), sources);
      if (actor.prefab !== undefined) {
        for (const inner of sources.live.expandedActors(id)) {
          rows.#add(inner, true, sources);
        }
      }
    }
    rows.#seal();

    return rows;
  }

  readonly roots: TreeNode[] = [];

  #nodes = new Map<string, TreeNode>();
  #parents = new Map<string, string>();
  #sections = new Map<string, ActorSection>();
  #anchorRows = new Map<string, ActorAnchor>();
  #componentRows = new Map<string, ComponentFocus>();

  anchorRow(
    id: string
  ): ActorAnchor | null {
    return this.#anchorRows.get(id) ?? null;
  }

  componentRow(
    id: string
  ): ComponentFocus | null {
    return this.#componentRows.get(id) ?? null;
  }

  isActor(
    id: string
  ): boolean {
    return this.#sections.has(id);
  }

  isInner(
    id: string
  ): boolean {
    const ownerId = this.anchorRow(id)?.ownerId ??
      this.componentRow(id)?.ownerId ??
      id;

    return Systems.InstancePath.parse(ownerId) !== null;
  }

  ids(): IterableIterator<string> {
    return this.#nodes.keys();
  }

  * branchIds(): IterableIterator<string> {
    for (const [id, node] of this.#nodes) {
      if (node.children !== undefined) {
        yield id;
      }
    }
  }

  * ancestorIds(
    id: string
  ): IterableIterator<string> {
    for (
      let parentId = this.#parents.get(id);
      parentId !== undefined;
      parentId = this.#parents.get(parentId)
    ) {
      yield parentId;
    }
  }

  accepts(
    detail: JollyReparentDetail
  ): boolean {
    return this.#dragsComponent(detail) ?
      this.#componentMove(detail) !== null :
      this.#acceptsActors(detail);
  }

  drop(
    detail: JollyReparentDetail
  ): HierarchyDrop | null {
    if (this.#dragsComponent(detail)) {
      const move = this.#componentMove(detail);

      return move === null ? null : {
        kind: "component",
        move
      };
    }

    const moves = resolveReparentMoves({
      nodes: this.roots,
      ...detail,
      accept: (candidate) => this.#acceptsActors(candidate)
    }).map(({ id, parentId, beforeId }): ActorMove => {
      const row = parentId === null ? null : this.anchorRow(parentId);

      return {
        id,
        parentId: row?.ownerId ?? parentId,
        ...row === null ? {} : { anchor: row.anchor },
        ...beforeId === undefined ? {} : { beforeId }
      };
    });

    return moves.length === 0 ? null : {
      kind: "actors",
      moves
    };
  }

  #dragsComponent(
    detail: JollyReparentDetail
  ): boolean {
    return detail.movedIds.some((id) => this.componentRow(id) !== null);
  }

  #acceptsActors(
    detail: JollyReparentDetail
  ): boolean {
    if (
      this.isInner(detail.targetId) ||
      this.componentRow(detail.targetId) !== null ||
      detail.movedIds.some((id) => !this.isActor(id) || this.isInner(id))
    ) {
      return false;
    }

    return detail.where === "inside" ?
      this.#sections.get(detail.targetId)?.closed !== true :
      this.anchorRow(detail.targetId) === null;
  }

  #componentMove(
    detail: JollyReparentDetail
  ): ComponentMove | null {
    const { movedIds: [movedId, ...others], targetId, where } = detail;
    const moved = movedId === undefined ? null : this.componentRow(movedId);
    const target = this.componentRow(targetId);
    if (
      moved === null ||
      others.length > 0 ||
      target === null ||
      where === "inside" ||
      moved.ownerId !== target.ownerId ||
      moved.componentId === target.componentId ||
      this.isInner(targetId)
    ) {
      return null;
    }

    const order = this.#componentIds(moved.ownerId);
    const rest = order.filter((id) => id !== moved.componentId);
    const beforeId = where === "above" ?
      target.componentId :
      rest[rest.indexOf(target.componentId) + 1];
    if (beforeId === order[order.indexOf(moved.componentId) + 1]) {
      return null;
    }

    return beforeId === undefined ?
      { id: moved.componentId } :
      {
        id: moved.componentId,
        beforeId
      };
  }

  #componentIds(
    ownerId: string
  ): string[] {
    const nodes = this.#sections.get(ownerId)?.components ?? [];

    return nodes.flatMap(({ id }) => this.componentRow(id)?.componentId ?? []);
  }

  #add(
    actor: SceneActorView,
    closed: boolean,
    sources: RowSources
  ): void {
    const node = actorNode(actor, sources.marks);
    const components = actor.components.map(
      (component) => this.#componentNode(actor.id, component, sources)
    );
    numberTwins(components);
    const section: ActorSection = {
      components,
      loose: [],
      actors: [],
      closed
    };
    this.#nodes.set(actor.id, node);
    this.#sections.set(actor.id, section);
    for (const { component, anchor } of sources.live.anchors(actor.id)) {
      this.#anchorNode(actorAnchor(actor.id, { component, key: anchor.key }), anchor);
    }

    const parent = actor.parentId === null ?
      undefined :
      this.#sections.get(actor.parentId);
    if (actor.parentId === null || parent === undefined) {
      this.roots.push(node);

      return;
    }

    if (actor.anchor === undefined) {
      this.#parents.set(actor.id, actor.parentId);
      parent.actors.push(node);

      return;
    }

    const row = actorAnchor(actor.parentId, actor.anchor);
    const rowId = HierarchyRows.anchorRowId(row);
    const rowNode = this.#nodes.get(rowId) ?? this.#anchorNode(row, null);
    this.#parents.set(actor.id, rowId);
    (rowNode.children ??= []).push(node);
  }

  #componentNode(
    ownerId: string,
    component: SceneComponentView,
    { components, naming, loadable }: RowSources
  ): TreeNode {
    const id = HierarchyRows.componentRowId(component.id);
    const { label, detail } = components.summary(component, naming);
    const warning = componentWarning(component, components, loadable);
    const node: TreeNode = {
      id,
      label,
      icon: components.icon(component.type),
      renamable: false,
      ...detail === undefined ? {} : { detail },
      ...warning === null ? {} : { warning }
    };
    this.#nodes.set(id, node);
    this.#parents.set(id, ownerId);
    this.#componentRows.set(id, {
      ownerId,
      componentId: component.id
    });

    return node;
  }

  #anchorNode(
    row: ActorAnchor,
    found: Systems.ComponentAnchor | null
  ): TreeNode {
    const node = anchorNode(row, found);
    const componentRowId = HierarchyRows.componentRowId(row.anchor.component);
    const component = this.#nodes.get(componentRowId);
    this.#nodes.set(node.id, node);
    this.#anchorRows.set(node.id, row);
    if (component === undefined) {
      this.#parents.set(node.id, row.ownerId);
      this.#sections.get(row.ownerId)?.loose.push(node);
    }
    else {
      this.#parents.set(node.id, componentRowId);
      (component.children ??= []).push(node);
    }

    return node;
  }

  #seal(): void {
    for (const [id, { components, loose, actors }] of this.#sections) {
      const children = [...components, ...loose, ...actors];
      const node = this.#nodes.get(id);
      if (node !== undefined && children.length > 0) {
        node.children = children;
      }
    }
  }
}

function numberTwins(
  nodes: readonly TreeNode[]
): void {
  const twins = Map.groupBy(
    nodes,
    ({ label, detail = "" }) => `${label}\u0000${detail}`
  );
  for (const group of twins.values()) {
    if (group.length < 2) {
      continue;
    }

    for (const [index, node] of group.entries()) {
      const rank = `#${index + 1}`;
      node.detail = node.detail === undefined ? rank : `${node.detail} ${rank}`;
    }
  }
}

function componentWarning(
  component: SceneComponentView,
  components: RowComponents,
  loadable: Systems.LoadableAssets
): string | null {
  if (components.find(component.type) === undefined) {
    return kMissingComponent;
  }

  const slot = components.missingAsset(component, loadable);

  return slot === null ?
    null :
    `Its "${slot}" asset is gone or of another kind. The game skips this component.`;
}

function anchorNode(
  row: ActorAnchor,
  found: Systems.ComponentAnchor | null
): TreeNode {
  const id = HierarchyRows.anchorRowId(row);

  return found === null ?
    {
      id,
      label: "Missing anchor",
      icon: kAnchorIcon,
      renamable: false,
      warning: kMissingAnchor
    } :
    {
      id,
      label: found.label,
      icon: kAnchorIcon,
      detail: found.kind,
      renamable: false
    };
}

function actorNode(
  actor: SceneActorView,
  marks: PeerMarks<string>
): TreeNode {
  const badges = marks.badges(actor.id);

  return {
    id: actor.id,
    label: actor.name,
    icon: actor.prefab === undefined ? EMPTY_ACTOR_ICON : PREFAB_ICON,
    visible: actor.visible,
    renamable: true,
    ...badges.length > 0 ? { badges } : {}
  };
}
