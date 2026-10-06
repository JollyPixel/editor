// Import Internal Dependencies
import type { IconName } from "../../icon/registry.ts";
import type {
  TreeBadge,
  TreeDropWhere,
  TreeSwatch,
  TreeSwatchPosition
} from "./contract.ts";
import {
  isExpandable,
  type FlatTreeRow
} from "./model.ts";

// CONSTANTS
const kNoBadges: readonly TreeBadge[] = Object.freeze([]);

export interface TreeRowState {
  position: number;
  setSize: number;
  expanded: boolean;
  selected: boolean;
  active: boolean;
  drop: TreeDropWhere | null;
  dropIndent: string;
  dragSource: boolean;
  moveCursor: boolean;
  renaming: boolean;
  renameError: string | null;
  hasBranches: boolean;
  swatchPosition: TreeSwatchPosition;
  reorderable: boolean;
}

export class TreeRowView {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName | undefined;
  readonly detail: string | undefined;
  readonly warning: string | undefined;
  readonly visible: boolean | undefined;
  readonly locked: boolean | undefined;
  readonly swatch: Readonly<TreeSwatch> | undefined;
  readonly badges: readonly Readonly<TreeBadge>[];
  readonly branch: boolean;
  readonly depth: number;
  readonly indent: string;
  readonly position: number;
  readonly setSize: number;
  readonly expanded: boolean;
  readonly selected: boolean;
  readonly active: boolean;
  readonly drop: TreeDropWhere | null;
  readonly dropIndent: string;
  readonly dragSource: boolean;
  readonly moveCursor: boolean;
  readonly renaming: boolean;
  readonly renameError: string | null;
  readonly hasBranches: boolean;
  readonly swatchPosition: TreeSwatchPosition;
  readonly reorderable: boolean;

  static indentOf(
    depth: number
  ): string {
    return `calc(${depth} * var(--jolly-tree-indent, 16px))`;
  }

  constructor(
    row: FlatTreeRow<unknown>,
    state: TreeRowState
  ) {
    const { node, depth } = row;
    this.id = node.id;
    this.label = node.label;
    this.icon = node.icon;
    this.detail = node.detail;
    this.warning = node.warning;
    this.visible = node.visible;
    this.locked = node.locked;
    this.swatch = node.swatch === undefined ?
      undefined :
      Object.freeze({ ...node.swatch });
    this.badges = node.badges === undefined || node.badges.length === 0 ?
      kNoBadges :
      Object.freeze(node.badges.map((badge) => Object.freeze({ ...badge })));
    this.branch = isExpandable(node);
    this.depth = depth;
    this.indent = TreeRowView.indentOf(depth);
    this.position = state.position;
    this.setSize = state.setSize;
    this.expanded = state.expanded;
    this.selected = state.selected;
    this.active = state.active;
    this.drop = state.drop;
    this.dropIndent = state.dropIndent;
    this.dragSource = state.dragSource;
    this.moveCursor = state.moveCursor;
    this.renaming = state.renaming;
    this.renameError = state.renameError;
    this.hasBranches = state.hasBranches;
    this.swatchPosition = state.swatchPosition;
    this.reorderable = state.reorderable;
    Object.freeze(this);
  }

  equals(
    other: TreeRowView
  ): boolean {
    return this.id === other.id &&
      this.label === other.label &&
      this.icon === other.icon &&
      this.detail === other.detail &&
      this.warning === other.warning &&
      this.visible === other.visible &&
      this.locked === other.locked &&
      this.branch === other.branch &&
      this.depth === other.depth &&
      this.position === other.position &&
      this.setSize === other.setSize &&
      this.expanded === other.expanded &&
      this.selected === other.selected &&
      this.active === other.active &&
      this.drop === other.drop &&
      this.dropIndent === other.dropIndent &&
      this.dragSource === other.dragSource &&
      this.moveCursor === other.moveCursor &&
      this.renaming === other.renaming &&
      this.renameError === other.renameError &&
      this.hasBranches === other.hasBranches &&
      this.swatchPosition === other.swatchPosition &&
      this.reorderable === other.reorderable &&
      sameSwatch(this.swatch, other.swatch) &&
      sameBadges(this.badges, other.badges);
  }
}

function sameSwatch(
  left: Readonly<TreeSwatch> | undefined,
  right: Readonly<TreeSwatch> | undefined
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }

  return left.title === right.title &&
    left.color === right.color &&
    left.ring === right.ring;
}

function sameBadges(
  left: readonly Readonly<TreeBadge>[],
  right: readonly Readonly<TreeBadge>[]
): boolean {
  return left.length === right.length && left.every(
    (badge, index) => badge.color === right[index].color &&
      badge.title === right[index].title
  );
}

export class TreeRowViewList {
  #byId = new Map<string, TreeRowView>();
  #views: TreeRowView[] = [];

  indexOf(
    id: string
  ): number {
    const view = this.#byId.get(id);

    return view === undefined ? -1 : this.#views.indexOf(view);
  }

  update(
    rows: readonly FlatTreeRow<unknown>[],
    stateOf: (row: FlatTreeRow<unknown>) => TreeRowState
  ): TreeRowView[] {
    const byId = new Map<string, TreeRowView>();
    let changed = rows.length !== this.#views.length;
    const views = rows.map((row, index) => {
      const view = new TreeRowView(row, stateOf(row));
      const known = this.#byId.get(view.id);
      const kept = known !== undefined && known.equals(view) ? known : view;
      byId.set(kept.id, kept);
      changed ||= kept !== this.#views[index];

      return kept;
    });
    this.#byId = byId;
    if (changed) {
      this.#views = views;
    }

    return this.#views;
  }
}
