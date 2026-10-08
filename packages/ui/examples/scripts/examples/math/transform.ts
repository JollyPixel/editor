// Import Internal Dependencies
import "../../../../src/math/Transform.ts";
import type { GalleryExample } from "../../types.ts";
import { detailOf } from "../../../../src/dom.ts";
import { peerColor } from "../../../../src/theme/peerColor.ts";
import type { JollyChangeDetail } from "../../../../src/field/events.ts";
import type { Transform } from "../../../../src/math/Transform.ts";
import {
  AXIS_STYLE_OPTIONS,
  axisStyleOf,
  type AxisStyleOptionKey
} from "./axisStyle.ts";

type TransformOptionKey =
  | "stacked"
  | "lockedRotation"
  | AxisStyleOptionKey;

export const TRANSFORM_EXAMPLE: GalleryExample<TransformOptionKey> = {
  options: [
    {
      key: "stacked",
      label: "Stacked labels"
    },
    {
      key: "lockedRotation",
      label: "Locked rotation",
      initial: true
    },
    ...AXIS_STYLE_OPTIONS
  ],
  render(host, options) {
    const transform = document.createElement("jolly-transform");
    transform.axisStyle = axisStyleOf(options);
    if (options.stacked) {
      transform.labelPosition = "top";
    }
    transform.value = {
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    };
    if (options.lockedRotation) {
      transform.state = {
        rotation: {
          lockedBy: {
            clientId: "peer-ada",
            displayName: "Ada",
            color: peerColor(0)
          }
        }
      };
    }

    transform.addEventListener("jolly-change", (event) => {
      const detail = detailOf<JollyChangeDetail<Transform["value"]>>(event);
      if (detail !== null) {
        transform.value = detail.value;
      }
    });

    host.append(transform);
  }
};
