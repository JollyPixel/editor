// Import Internal Dependencies
import { Mixed } from "../../src/field/mixed.ts";
import { peerColor } from "../../src/peer/peerColor.ts";
import { readDetail } from "../../src/dom.ts";
import type { PresencePeer } from "../../src/peer/PresencePeer.ts";
import type { JollyChangeDetail } from "../../src/field/events.ts";

export interface FieldLike {
  label: string;
  value: unknown;
  default?: unknown;
  error: string | null;
  disabled: boolean;
  readonly: boolean;
  colored: boolean;
  editors: readonly PresencePeer[];
  labelPosition: "inline" | "top" | "auto";
}

export interface StateMatrixOptions<
  TField extends HTMLElement & FieldLike
> {
  create(): TField;
  applyMixed?(
    field: TField
  ): void;
  modified?(
    field: TField
  ): void;
  /**
   * Adds accent and accent plus modified rows for controls with colored paint.
   */
  colored?: boolean;
  /**
   * Also write back `jolly-input`, for a control whose continuous phase has no draft of its own
   * (`jolly-number`'s scrub, `jolly-slider`'s drag) and so needs `value` kept live to redraw.
   */
  liveInput?: boolean;
}

export type MatrixState =
  | typeof kRows[number]
  | typeof kColoredRows[number];

// CONSTANTS
const kHolder: PresencePeer = {
  clientId: "peer-ada",
  displayName: "Ada",
  color: peerColor("peer-ada")
};

const kRows = [
  "default",
  "mixed",
  "modified",
  "error",
  "disabled",
  "readonly",
  "locked",
  "peers",
  "mixed+modified",
  "stacked+modified+peers"
] as const;

const kColoredRows = [
  "colored",
  "colored+modified"
] as const;

const kCrowd: PresencePeer[] = [
  {
    clientId: "peer-me",
    displayName: "Me",
    color: peerColor("peer-me"),
    self: true
  },
  {
    clientId: "peer-linus",
    displayName: "Linus",
    color: peerColor("peer-linus")
  },
  {
    clientId: "peer-grace",
    displayName: "Grace",
    color: peerColor("peer-grace")
  },
  {
    clientId: "peer-alan",
    displayName: "Alan",
    color: peerColor("peer-alan")
  },
  {
    clientId: "peer-edsger",
    displayName: "Edsger",
    color: peerColor("peer-edsger")
  },
  {
    clientId: "peer-barbara",
    displayName: "Barbara",
    color: peerColor("peer-barbara")
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
  if (options.colored) {
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

  const field = options.create();
  applyState(
    field,
    state,
    options
  );

  function writeBack(
    event: Event
  ): void {
    const detail = readDetail<JollyChangeDetail<unknown>>(
      event
    );
    if (detail !== null) {
      field.value = detail.value;
    }
  }

  if (options.liveInput) {
    field.addEventListener(
      "jolly-input",
      writeBack
    );
  }
  field.addEventListener(
    "jolly-change",
    writeBack
  );

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
      field.editors = [kHolder];
      break;
    case "peers":
      field.editors = kCrowd;
      break;
    case "colored":
      field.colored = true;
      break;
    case "colored+modified":
      field.colored = true;
      setModified?.(field);
      break;
    case "mixed+modified":
      setMixed(field);
      break;
    case "stacked+modified+peers":
      field.labelPosition = "top";
      field.editors = kCrowd;
      setModified?.(field);
      break;
    default:
      break;
  }
}
