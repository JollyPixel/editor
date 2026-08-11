// Import Internal Dependencies
import {
  Mixed,
  peerColor,
  detailOf,
  type CollaboratorPresence,
  type JollyChangeDetail
} from "../../src/index.ts";

/** Structural, so the helper never imports a control and every field satisfies it. */
export interface FieldLike {
  label: string;
  value: unknown;
  default?: unknown;
  error: string | null;
  disabled: boolean;
  readonly: boolean;
  colored: boolean;
  lockedBy: CollaboratorPresence | null;
  peers: CollaboratorPresence[];
}

export interface StateMatrixOptions<
  TField extends HTMLElement & FieldLike
> {
  /** A fresh, fully configured element in its default state. Called once per row. */
  create(): TField;
  /** Override when a control needs more than assigning the sentinel. */
  applyMixed?(field: TField): void;
  /** A value differing from `default`, so the revert gutter appears. */
  modified?(field: TField): void;
  /** Adds accent and accent plus modified rows for controls with colored paint. */
  colored?: boolean;
  /**
   * Also write back `jolly-input`, for a control whose continuous phase has no draft of its own
   * (`jolly-number`'s scrub, `jolly-slider`'s drag) and so needs `value` kept live to redraw.
   * `jolly-text` and `jolly-number`'s typed entry already render their own draft and must stay off
   * this, or a keystroke would land in `value` before Enter, blur, or Escape says it should.
   */
  liveInput?: boolean;
}

/**
 * Nine rows, fixed, no opt out: the point of a shared matrix is that every control renders the
 * same states, and a per control row list is how they drift apart.
 *
 * Focus is not a row. Only one element can hold it, so the locked plus focused case is produced by
 * the end to end test focusing the `locked` row.
 */
const kRows = [
  "default",
  "mixed",
  "modified",
  "error",
  "disabled",
  "readonly",
  "locked",
  "peers",
  "mixed+modified"
] as const;

const kColoredRows = [
  "colored",
  "colored+modified"
] as const;

export type MatrixState =
  | typeof kRows[number]
  | typeof kColoredRows[number];

// CONSTANTS
const kHolder: CollaboratorPresence = {
  clientId: "peer-ada",
  displayName: "Ada",
  color: peerColor(0),
  editing: "example.field"
};

/** None of them is editing, so this row shows presence alone and stays distinct from `locked`. */
const kCrowd: CollaboratorPresence[] = [
  {
    clientId: "peer-linus",
    displayName: "Linus",
    color: peerColor(1)
  },
  {
    clientId: "peer-grace",
    displayName: "Grace",
    color: peerColor(2)
  },
  {
    clientId: "peer-alan",
    displayName: "Alan",
    color: peerColor(3)
  },
  {
    clientId: "peer-edsger",
    displayName: "Edsger",
    color: peerColor(4)
  },
  {
    clientId: "peer-barbara",
    displayName: "Barbara",
    color: peerColor(5)
  }
];

export function renderStateMatrix<
  TField extends HTMLElement & FieldLike
>(
  host: HTMLElement,
  options: StateMatrixOptions<TField>
): () => void {
  const grid = document.createElement("div");
  grid.className = "state-matrix";
  const states: MatrixState[] = [...kRows];
  if (options.colored === true) {
    states.push(...kColoredRows);
  }

  for (const state of states) {
    grid.append(
      buildRow(state, options)
    );
  }

  host.append(grid);

  return () => grid.remove();
}

function buildRow<
  TField extends HTMLElement & FieldLike
>(
  state: MatrixState,
  options: StateMatrixOptions<TField>
): HTMLElement {
  const row = document.createElement("div");
  row.className = "state-row";
  row.dataset.state = state;

  const caption = document.createElement("code");
  caption.className = "state-name";
  caption.textContent = state;

  // A fresh element per row, so one row's draft cannot leak into another.
  const field = options.create();
  applyState(field, state, options);

  // The write back every consumer owes a controlled element, per docs/fields.md.
  function writeBack(
    event: Event
  ): void {
    const detail = detailOf<JollyChangeDetail<unknown>>(
      event
    );
    if (detail !== null) {
      field.value = detail.value;
    }
  }
  // A scrub only ever fires jolly-input until release, so jolly-change alone would leave the
  // number or slider static on screen for the whole drag.
  if (options.liveInput) {
    field.addEventListener("jolly-input", writeBack);
  }
  field.addEventListener("jolly-change", writeBack);

  row.append(caption, field);

  return row;
}

function applyState<
  TField extends HTMLElement & FieldLike
>(
  field: TField,
  state: MatrixState,
  options: StateMatrixOptions<TField>
): void {
  const setMixed = options.applyMixed ?? ((target: TField) => {
    target.value = Mixed;
  });
  const setModified = options.modified;

  switch (state) {
    // No default, so this row is mixed alone and the gutter stays empty.
    case "mixed":
      setMixed(field);
      field.default = undefined;
      break;
    case "modified":
      setModified?.(field);
      break;
    case "error":
      field.error = "Value is out of range";
      break;
    case "disabled":
      field.disabled = true;
      break;
    case "readonly":
      field.readonly = true;
      break;
    case "locked":
      field.lockedBy = kHolder;
      field.peers = [kHolder];
      break;
    case "peers":
      field.peers = kCrowd;
      break;
    case "colored":
      field.colored = true;
      break;
    case "colored+modified":
      field.colored = true;
      setModified?.(field);
      break;
    // Mixed is modified whenever a default exists, so this needs no second step.
    case "mixed+modified":
      setMixed(field);
      break;
    default:
      break;
  }
}
