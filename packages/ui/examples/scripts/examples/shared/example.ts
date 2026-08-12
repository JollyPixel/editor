// Import Internal Dependencies
import type { GalleryExample } from "../../types.ts";

export function createSimpleExample(
  id: string,
  title: string,
  group: string,
  build: () => HTMLElement
): GalleryExample {
  return {
    id,
    title,
    group,
    render(host) {
      const element = build();
      host.append(element);

      return () => element.remove();
    }
  };
}
