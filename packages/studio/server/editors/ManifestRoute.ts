// Import Third-party Dependencies
import {
  bytesSource,
  servo,
  type ServoHandler
} from "@openally/servo";

// Import Internal Dependencies
import {
  PROJECT_MANIFEST_FILE,
  ProjectManifest
} from "../../src/editors/ProjectManifest.ts";
import type { StudioProject } from "../project/StudioProject.ts";

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
      })
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
      const pathname = URL.parse(
        request.url ?? "/",
        "http://localhost"
      )?.pathname;

      if (pathname === `/${PROJECT_MANIFEST_FILE}`) {
        serve(request, response, next);
      }
      else {
        next?.();
      }
    };
  }
}
