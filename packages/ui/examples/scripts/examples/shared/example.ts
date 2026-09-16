// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";
import type { GalleryExampleId } from "../../groups.ts";

export function createSimpleExample(
  id: GalleryExampleId,
  title: string,
  build: () => HTMLElement
): GalleryExample {
  return {
    id,
    title,
    render(host) {
      host.append(build());
    }
  };
}
