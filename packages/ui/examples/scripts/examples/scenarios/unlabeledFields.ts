// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  peerColor,
  detailOf,
  type JollyChangeDetail,
  type Text
} from "../../../../src/index.ts";

/**
 * A field with an empty label gives its whole row to the value.
 */
export const UNLABELED_FIELDS_EXAMPLE: GalleryExample = {
  id: "scenarios/unlabeled-fields",
  title: "Unlabeled fields",
  group: "Scenarios",
  render(host) {
    const root = document.createElement("div");
    root.className = "scenario-grid";

    const hint = document.createElement("p");
    hint.className = "scenario-hint";
    hint.textContent = "Leave the label empty and the value takes the row, inset by the same "
      + "step on both edges.";

    root.append(
      hint,
      buildRow("labelled", (field) => {
        field.label = "Layer name";
        field.value = "Background";
      }),
      buildRow("unlabeled", (field) => {
        field.value = "Background";
      }),
      buildRow("unlabeled+description", (field) => {
        field.value = "Background";
        field.description = "Shown in the layer list";
      }),
      buildRow("unlabeled+locked", (field) => {
        field.value = "Background";
        field.lockedBy = {
          clientId: "peer-ada",
          displayName: "Ada",
          color: peerColor(0)
        };
      }),
      buildRow("unlabeled+top", (field) => {
        field.value = "Background";
        field.labelPosition = "top";
      }),
      buildPair()
    );
    host.append(root);

    return () => root.remove();
  }
};

function buildRow(
  state: string,
  configure: (field: Text) => void
): HTMLElement {
  const row = createRow(state);
  row.append(createField(configure));

  return row;
}

/** The custom-property shape: two label-less fields sharing one line. */
function buildPair(): HTMLElement {
  const row = createRow("pair");
  const grid = document.createElement("div");
  grid.className = "prop-pair";
  grid.append(
    createField((field) => {
      field.placeholder = "key";
      field.value = "spawn";
    }),
    createField((field) => {
      field.placeholder = "value";
      field.value = "player";
    })
  );
  row.append(grid);

  return row;
}

function createRow(
  state: string
): HTMLElement {
  const row = document.createElement("div");
  row.className = "state-row";
  row.dataset.state = state;

  const caption = document.createElement("code");
  caption.className = "state-name";
  caption.textContent = state;
  row.append(caption);

  return row;
}

function createField(
  configure: (field: Text) => void
): Text {
  const field = document.createElement("jolly-text");
  field.placeholder = "Untitled";
  configure(field);

  field.addEventListener("jolly-change", (event) => {
    const detail = detailOf<JollyChangeDetail<string>>(event);
    if (detail !== null) {
      field.value = detail.value;
    }
  });

  return field;
}
