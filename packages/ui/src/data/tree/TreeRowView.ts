// Import Internal Dependencies
import type { IconName } from "../../icon/registry.ts";
import type { PeerAvatar } from "../../peer/Avatar.ts";
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
const kIndents: string[] = [];

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
  readonly avatar: Readonly<PeerAvatar> | undefined;
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
    kIndents[depth] ??= `calc(${depth} * var(--jolly-tree-indent, 16px))`;

    return kIndents[depth];
  }

  constructor(
    row: FlatTreeRow<unknown>,
    state: TreeRowState
  ) {
    const { node, depth } = row;
    this.id = node.id;
    this.label = node.label;
    this.icon = node.icon;
    this.avatar = node.avatar === undefined ?
      undefined :
      Object.freeze({ ...node.avatar });
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

  matches(
    row: FlatTreeRow<unknown>,
    state: TreeRowState
  ): boolean {
    const { node } = row;

    return this.id === node.id &&
      this.label === node.label &&
      this.icon === node.icon &&
      sameAvatar(this.avatar, node.avatar) &&
      this.detail === node.detail &&
      this.warning === node.warning &&
      this.visible === node.visible &&
      this.locked === node.locked &&
      this.branch === isExpandable(node) &&
      this.depth === row.depth &&
      this.position === state.position &&
      this.setSize === state.setSize &&
      this.expanded === state.expanded &&
      this.selected === state.selected &&
      this.active === state.active &&
      this.drop === state.drop &&
      this.dropIndent === state.dropIndent &&
      this.dragSource === state.dragSource &&
      this.moveCursor === state.moveCursor &&
      this.renaming === state.renaming &&
      this.renameError === state.renameError &&
      this.hasBranches === state.hasBranches &&
      this.swatchPosition === state.swatchPosition &&
      this.reorderable === state.reorderable &&
      sameSwatch(this.swatch, node.swatch) &&
      sameBadges(this.badges, node.badges ?? kNoBadges);
  }
}

function sameAvatar(
  left: Readonly<PeerAvatar> | undefined,
  right: Readonly<PeerAvatar> | undefined
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }

  return left.peerId === right.peerId &&
    left.color === right.color &&
    left.image === right.image;
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
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index++) {
    if (
      left[index].color !== right[index].color ||
      left[index].title !== right[index].title ||
      left[index].icon !== right[index].icon
    ) {
      return false;
    }
  }

  return true;
}

interface ListedView {
  view: TreeRowView;
  generation: number;
}

export class TreeRowViewList {
  #byId = new Map<string, ListedView>();
  #views: TreeRowView[] = [];
  #generation = 0;

  indexOf(
    id: string
  ): number {
    const listed = this.#byId.get(id);

    return listed === undefined ? -1 : this.#views.indexOf(listed.view);
  }

  update(
    rows: readonly FlatTreeRow<unknown>[],
    stateOf: (row: FlatTreeRow<unknown>) => TreeRowState
  ): TreeRowView[] {
    const previous = this.#views;
    const generation = ++this.#generation;
    let views: TreeRowView[] | null = rows.length === previous.length ?
      null :
      [];
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const view = this.#viewFor(row, stateOf(row), generation);
      if (views === null && view !== previous[index]) {
        views = previous.slice(0, index);
      }
      views?.push(view);
    }
    if (this.#byId.size > rows.length) {
      this.#forgetUnlisted(generation);
    }
    if (views !== null) {
      this.#views = views;
    }

    return this.#views;
  }

  #viewFor(
    row: FlatTreeRow<unknown>,
    state: TreeRowState,
    generation: number
  ): TreeRowView {
    const listed = this.#byId.get(row.node.id);
    if (listed === undefined) {
      const view = new TreeRowView(row, state);
      this.#byId.set(view.id, {
        view,
        generation
      });

      return view;
    }

    listed.generation = generation;
    if (!listed.view.matches(row, state)) {
      listed.view = new TreeRowView(row, state);
    }

    return listed.view;
  }

  #forgetUnlisted(
    generation: number
  ): void {
    for (const [id, listed] of this.#byId) {
      if (listed.generation !== generation) {
        this.#byId.delete(id);
      }
    }
  }
}
