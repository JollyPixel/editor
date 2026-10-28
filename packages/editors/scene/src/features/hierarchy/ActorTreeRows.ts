// Import Third-party Dependencies
import type {
  SceneActorJSON,
  SceneAnchorJSON,
  SceneTreeReader
} from "@jolly-pixel/asset.scene/client";
import type { Systems } from "@jolly-pixel/engine";
import {
  resolveReparentMoves,
  type JollyReparentDetail,
  type TreeNode
} from "@jolly-pixel/ui";
import {
  peerBadges,
  type PeerMarkMap
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { SceneComponents } from "../../components/SceneComponents.ts";
import type { ActorMove } from "../../editing/SceneActions.ts";

// CONSTANTS
export const PREFAB_ICON = "actor-prefab";
export const ANCHOR_ICON = "actor-anchor";
const kMissingAnchor = "The anchor is gone from the asset; its actors sit at the parent's origin";

type ActorAnchors = Pick<Systems.SceneAnchorsReader, "anchors">;

export interface AnchorRow {
  ownerId: string;
  anchor: SceneAnchorJSON;
}

type RowNode = TreeNode<AnchorRow>;

interface ActorSections {
  anchors: RowNode[];
  actors: RowNode[];
}

export class ActorTreeRows {
  static readonly EMPTY = new ActorTreeRows();

  static read(
    tree: Pick<SceneTreeReader, "actorIds" | "peekActor">,
    marks: PeerMarkMap<string>,
    components: Pick<SceneComponents, "actorIcon">,
    anchors: ActorAnchors
  ): ActorTreeRows {
    const rows = new ActorTreeRows();
    for (const id of tree.actorIds()) {
      const actor = tree.peekActor(id);
      if (actor !== undefined) {
        rows.#add(actor, marks, components, anchors);
      }
    }
    rows.#seal();

    return rows;
  }

  readonly roots: RowNode[] = [];

  #nodes = new Map<string, RowNode>();
  #parents = new Map<string, string>();
  #sections = new Map<string, ActorSections>();

  anchorRow(
    id: string
  ): AnchorRow | null {
    return this.#nodes.get(id)?.data ?? null;
  }

  ids(): IterableIterator<string> {
    return this.#nodes.keys();
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
    return !detail.movedIds.some((id) => this.anchorRow(id) !== null) &&
      (detail.where === "inside" || this.anchorRow(detail.targetId) === null);
  }

  moves(
    detail: JollyReparentDetail
  ): ActorMove[] {
    return resolveReparentMoves({
      nodes: this.roots,
      ...detail,
      accept: (candidate) => this.accepts(candidate)
    }).map(({ id, parentId, beforeId }) => {
      const row = parentId === null ? null : this.anchorRow(parentId);

      return {
        id,
        parentId: row?.ownerId ?? parentId,
        ...row === null ? {} : { anchor: row.anchor },
        ...beforeId === undefined ? {} : { beforeId }
      };
    });
  }

  #add(
    actor: Readonly<SceneActorJSON>,
    marks: PeerMarkMap<string>,
    components: Pick<SceneComponents, "actorIcon">,
    anchors: ActorAnchors
  ): void {
    const node = actorNode(actor, marks, components);
    this.#nodes.set(actor.id, node);
    this.#sections.set(actor.id, {
      anchors: Array.from(
        anchors.anchors(actor.id),
        ({ component, anchor }) => this.#anchorNode(
          anchorRow(actor.id, { component, key: anchor.key }),
          anchor
        )
      ),
      actors: []
    });

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

    const row = anchorRow(actor.parentId, actor.anchor);
    const rowId = anchorRowId(row);
    let rowNode = this.#nodes.get(rowId);
    if (rowNode === undefined) {
      rowNode = this.#anchorNode(row, null);
      parent.anchors.push(rowNode);
    }
    this.#parents.set(actor.id, rowId);
    (rowNode.children ??= []).push(node);
  }

  #anchorNode(
    row: AnchorRow,
    found: Systems.ComponentAnchor | null
  ): RowNode {
    const node = anchorNode(row, found);
    this.#nodes.set(node.id, node);
    this.#parents.set(node.id, row.ownerId);

    return node;
  }

  #seal(): void {
    for (const [id, { anchors, actors }] of this.#sections) {
      const children = [...anchors, ...actors];
      const node = this.#nodes.get(id);
      if (node !== undefined && children.length > 0) {
        node.children = children;
      }
    }
  }
}

function anchorRow(
  ownerId: string,
  anchor: Readonly<SceneAnchorJSON>
): AnchorRow {
  return {
    ownerId,
    anchor: {
      component: anchor.component,
      key: anchor.key
    }
  };
}

function anchorRowId(
  row: AnchorRow
): string {
  return `anchor:${row.ownerId}/${row.anchor.component}/${row.anchor.key}`;
}

function anchorNode(
  row: AnchorRow,
  found: Systems.ComponentAnchor | null
): RowNode {
  const id = anchorRowId(row);

  return found === null ?
    {
      id,
      label: "Missing anchor",
      icon: ANCHOR_ICON,
      renamable: false,
      warning: kMissingAnchor,
      data: row
    } :
    {
      id,
      label: found.label,
      icon: ANCHOR_ICON,
      detail: found.kind,
      renamable: false,
      data: row
    };
}

function actorNode(
  actor: Readonly<SceneActorJSON>,
  marks: PeerMarkMap<string>,
  components: Pick<SceneComponents, "actorIcon">
): RowNode {
  const badges = peerBadges(actor.id, marks);

  return {
    id: actor.id,
    label: actor.name,
    icon: actor.prefab === undefined ?
      components.actorIcon(actor.components.map(({ type }) => type)) :
      PREFAB_ICON,
    visible: actor.visible,
    renamable: true,
    ...badges.length > 0 ? { badges } : {}
  };
}
