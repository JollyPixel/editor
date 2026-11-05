// Import Third-party Dependencies
import { DEFAULT_CATALOG_MAX_CONTENT_BYTES } from "@jolly-pixel/asset-server";
import {
  bytesSource,
  servo,
  type ServoHandler
} from "@openally/servo";

// Import Internal Dependencies
import {
  PROJECT_MANIFEST_FILE,
  ProjectManifest
} from "../../shared/ProjectManifest.ts";
import type { StudioProject } from "../project/StudioProject.ts";
import { requestPathname } from "../requestPathname.ts";

export class ManifestRoute {
  readonly source: string;
  readonly middleware: ServoHandler;

  constructor(
    project: StudioProject
  ) {
    this.source = JSON.stringify(new ProjectManifest({
      editors: project.editors.descriptors(),
      kinds: project.kinds.descriptors(),
      kindPackages: project.kinds.packages.map((kindPackage) => {
        return {
          name: kindPackage.name,
          kinds: kindPackage.descriptors.map(({ kind }) => kind)
        };
      }),
      maxContentBytes: DEFAULT_CATALOG_MAX_CONTENT_BYTES
    }));
    const bytes = new TextEncoder().encode(this.source);
    const serve = servo(
      bytesSource(
        async(file) => (file === PROJECT_MANIFEST_FILE ? bytes : null),
        { etag: "content" }
      ),
      { dev: true }
    );
    this.middleware = (request, response, next) => {
      if (requestPathname(request) === `/${PROJECT_MANIFEST_FILE}`) {
        serve(request, response, next);
      }
      else {
        next?.();
      }
    };
  }
}
