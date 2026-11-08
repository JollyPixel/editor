// Import Internal Dependencies
import "../../../../src/math/Transform.ts";
import type { GalleryExample } from "../../types.ts";
import { readDetail } from "../../../../src/dom.ts";
import { peerColor } from "../../../../src/peer/peerColor.ts";
import type { JollyChangeDetail } from "../../../../src/field/events.ts";
import type { Transform } from "../../../../src/math/Transform.ts";
import {
  AXIS_STYLE_OPTIONS,
  pickAxisStyle,
  type AxisStyleOptionKey
} from "./axisStyle.ts";

type TransformOptionKey =
  | "stacked"
  | "lockedRotation"
  | "eulerRotation"
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
    {
      key: "eulerRotation",
      label: "Euler rotation"
    },
    ...AXIS_STYLE_OPTIONS
  ],
  render(host, options) {
    const transform = document.createElement("jolly-transform");
    transform.axisStyle = pickAxisStyle(options);
    if (options.stacked) {
      transform.labelPosition = "top";
    }
    if (options.eulerRotation) {
      transform.rotationFormat = "euler";
    }
    transform.value = {
      position: { x: 0, y: 1, z: 0 },
      rotation: options.eulerRotation ?
        { x: 0, y: 0, z: 0 } :
        { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    };
    if (options.lockedRotation) {
      transform.state = {
        rotation: {
          editors: [{
            clientId: "peer-ada",
            displayName: "Ada",
            color: peerColor("peer-ada")
          }]
        }
      };
    }

    transform.addEventListener("jolly-change", (event) => {
      const detail = readDetail<JollyChangeDetail<Transform["value"]>>(event);
      if (detail !== null) {
        transform.value = detail.value;
      }
    });

    host.append(transform);
  }
};
