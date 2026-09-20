// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  detailOf,
  peerColor,
  type JollyChangeDetail,
  type Transform
} from "../../../../src/index.ts";

type TransformOptionKey =
  | "stacked"
  | "lockedRotation";

export const TRANSFORM_EXAMPLE: GalleryExample<TransformOptionKey> = {
  id: "math/transform",
  title: "Transform",
  options: [
    {
      key: "stacked",
      label: "Stacked labels"
    },
    {
      key: "lockedRotation",
      label: "Locked rotation",
      initial: true
    }
  ],
  render(host, options) {
    const transform = document.createElement("jolly-transform");
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
