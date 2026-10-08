// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";

export function createSimpleExample(
  build: () => HTMLElement
): GalleryExample {
  return {
    render(host) {
      host.append(build());
    }
  };
}
