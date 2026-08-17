// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  detailOf,
  Mixed,
  type JollyChangeDetail,
  type Vector3,
  type VectorValue
} from "../../../../src/index.ts";

type Axis3 = "x" | "y" | "z";

interface SceneObject {
  name: string;
  position: Record<Axis3, number>;
}

// CONSTANTS
const kAxes: readonly Axis3[] = ["x", "y", "z"];

/** Demonstrates per-axis Mixed state across two selected objects. */
export const MIXED_PER_AXIS_EXAMPLE: GalleryExample = {
  id: "scenarios/mixed-per-axis",
  title: "Mixed per axis",
  group: "Scenarios",
  render(host) {
    const selection: SceneObject[] = [
      { name: "Crate A", position: { x: 2, y: 1, z: -4 } },
      { name: "Crate B", position: { x: 2, y: 5, z: 8 } }
    ];

    const root = document.createElement("div");
    root.className = "scenario-grid";

    const hint = document.createElement("p");
    hint.className = "scenario-hint";
    hint.textContent = "Both crates share x, but disagree on y and z. Edit one axis and the "
      + "others stay Mixed.";

    const field = document.createElement("jolly-vector3") as Vector3;
    field.label = "Position";
    field.step = 0.5;

    const readout = document.createElement("ul");
    readout.className = "scenario-log";

    function selectionValue(): VectorValue<Axis3> {
      const [first, ...rest] = selection;
      const value: Partial<Record<Axis3, number | typeof Mixed>> = {};

      for (const axis of kAxes) {
        const agrees = rest.every((object) => object.position[axis] === first.position[axis]);
        value[axis] = agrees ? first.position[axis] : Mixed;
      }

      return value as VectorValue<Axis3>;
    }

    function renderReadout(): void {
      readout.replaceChildren(
        ...selection.map((object) => {
          const item = document.createElement("li");
          const { x, y, z } = object.position;
          item.textContent = `${object.name}: ${x}, ${y}, ${z}`;

          return item;
        })
      );
    }

    function refresh(): void {
      field.value = selectionValue();
      renderReadout();
    }

    field.addEventListener("jolly-change", (event) => {
      const detail = detailOf<JollyChangeDetail<VectorValue<Axis3>>>(event);
      if (detail === null || detail.value === Mixed) {
        return;
      }

      // Preserve each object's value for untouched Mixed axes.
      for (const object of selection) {
        for (const axis of kAxes) {
          const axisValue = detail.value[axis];
          if (axisValue !== Mixed) {
            object.position[axis] = axisValue;
          }
        }
      }

      refresh();
    });

    refresh();

    root.append(hint, field, readout);
    host.append(root);

    return () => root.remove();
  }
};
