// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import {
  Transform,
  detailOf,
  peerColor,
  type JollyChangeDetail
} from "../../../../src/index.ts";

export const TRANSFORM_EXAMPLE: GalleryExample = {
  id: "math/transform",
  title: "Transform",
  group: "Math",
  render(host) {
    const transform = document.createElement("jolly-transform") as Transform;
    transform.value = {
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    };
    // Locking is per sub-row: rotation is held by a peer, position and
    // scale stay editable.
    transform.state = {
      rotation: {
        lockedBy: {
          clientId: "peer-ada",
          displayName: "Ada",
          color: peerColor(0)
        }
      }
    };

    transform.addEventListener("jolly-change", (event) => {
      const detail = detailOf<JollyChangeDetail<Transform["value"]>>(event);
      if (detail !== null) {
        transform.value = detail.value;
      }
    });

    host.append(transform);

    return () => transform.remove();
  }
};

export const TRANSFORM_STACKED_EXAMPLE: GalleryExample = {
  id: "math/transform-stacked",
  title: "Transform (stacked labels)",
  group: "Math",
  render(host) {
    const transform = document.createElement("jolly-transform") as Transform;
    transform.labelPosition = "top";
    transform.value = {
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    };

    transform.addEventListener("jolly-change", (event) => {
      const detail = detailOf<JollyChangeDetail<Transform["value"]>>(event);
      if (detail !== null) {
        transform.value = detail.value;
      }
    });

    host.append(transform);

    return () => transform.remove();
  }
};
