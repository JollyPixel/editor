// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  detailOf,
  type FieldDescriptionDisplay,
  type JollyChangeDetail
} from "../../../../src/index.ts";

// CONSTANTS
const kStackBelow = 260;

export const FIELD_LAYOUT_EXAMPLE: GalleryExample = {
  id: "scenarios/field-layout",
  title: "Field layout",
  render(host) {
    const root = document.createElement("div");
    root.className = "scenario-grid";

    root.append(
      section(
        "revert",
        "Revert sits beside the label, so a modified row keeps the value column of its neighbours.",
        revertColumn()
      ),
      section(
        "descriptions",
        "The tooltip display keeps a described row one row tall; hover or focus the icon.",
        descriptionDisplays()
      ),
      section(
        "auto-stack",
        `Drag the corner: under ${kStackBelow}px each label moves above its value.`,
        autoStack()
      ),
      section(
        "auto-stack-transform",
        "A transform measures itself and stacks its three rows together.",
        autoStackTransform()
      )
    );
    host.append(root);
  }
};

function section(
  state: string,
  hint: string,
  content: HTMLElement
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "state-row";
  wrapper.dataset.state = state;

  const caption = document.createElement("code");
  caption.className = "state-name";
  caption.textContent = state;

  const text = document.createElement("p");
  text.className = "scenario-hint";
  text.textContent = hint;

  wrapper.append(caption, text, content);

  return wrapper;
}

function revertColumn(): HTMLElement {
  const column = document.createElement("div");
  column.className = "field-layout-column";

  const name = controlled(document.createElement("jolly-text"), "Cube");
  name.label = "Name";
  name.default = "Cube";

  const mass = controlled(document.createElement("jolly-number"), 4);
  mass.label = "Mass";
  mass.default = 1;
  mass.dataset.role = "modified";

  const friction = controlled(document.createElement("jolly-number"), 0.5);
  friction.label = "Friction";
  friction.default = 0.5;
  friction.dataset.role = "default";

  const shape = controlled(document.createElement("jolly-select"), "sphere");
  shape.label = "Shape";
  shape.options = [
    { value: "box", label: "Box" },
    { value: "sphere", label: "Sphere" }
  ];
  shape.default = "box";

  column.append(name, mass, friction, shape);

  return column;
}

function descriptionDisplays(): HTMLElement {
  const grid = document.createElement("div");
  grid.className = "field-layout-pair";
  grid.append(
    describedColumn("block"),
    describedColumn("tooltip")
  );

  return grid;
}

function describedColumn(
  display: FieldDescriptionDisplay
): HTMLElement {
  const column = document.createElement("div");
  column.className = "field-layout-column";
  column.dataset.display = display;

  const speed = controlled(document.createElement("jolly-number"), 2);
  speed.label = "Speed";
  speed.description = "Units per second, before the sprint multiplier";
  speed.descriptionDisplay = display;

  const loop = controlled(document.createElement("jolly-checkbox"), true);
  loop.label = "Loop";
  loop.align = "end";
  loop.description = "Restart the animation when it ends";
  loop.descriptionDisplay = display;

  const row = document.createElement("jolly-property-row");
  row.label = "Export";
  row.description = "Writes the clip next to the scene file";
  row.descriptionDisplay = display;
  const button = document.createElement("jolly-button");
  button.textContent = "Save";
  row.append(button);

  column.append(speed, loop, row);

  return column;
}

function autoStack(): HTMLElement {
  const box = document.createElement("div");
  box.className = "field-layout-resizable";
  box.dataset.role = "auto-stack";

  const name = controlled(document.createElement("jolly-text"), "Player");
  name.label = "Display name";
  name.labelPosition = "auto";
  name.stackBelow = kStackBelow;

  const scale = controlled(document.createElement("jolly-vector3"), {
    x: 1,
    y: 1,
    z: 1
  });
  scale.label = "Scale";
  scale.labelPosition = "auto";
  scale.stackBelow = kStackBelow;
  scale.description = "Multiplies the mesh around its pivot";
  scale.descriptionDisplay = "tooltip";

  const row = document.createElement("jolly-property-row");
  row.label = "Collision";
  row.labelPosition = "auto";
  row.stackBelow = kStackBelow;
  const button = document.createElement("jolly-button");
  button.textContent = "Edit shape";
  row.append(button);

  box.append(name, scale, row);

  return box;
}

function autoStackTransform(): HTMLElement {
  const box = document.createElement("div");
  box.className = "field-layout-resizable";
  box.dataset.role = "auto-stack-transform";

  const transform = document.createElement("jolly-transform");
  controlled(transform, transform.value);
  transform.labelPosition = "auto";
  transform.stackBelow = kStackBelow;

  box.append(transform);

  return box;
}

function controlled<TField extends HTMLElement & { value: unknown; }>(
  field: TField,
  value: TField["value"]
): TField {
  field.value = value;
  field.addEventListener("jolly-change", (event) => {
    if (event.composedPath()[0] !== field) {
      return;
    }

    const detail = detailOf<JollyChangeDetail<TField["value"]>>(event);
    if (detail !== null) {
      field.value = detail.value;
    }
  });

  return field;
}
