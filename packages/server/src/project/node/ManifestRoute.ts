// Import Third-party Dependencies
import { DEFAULT_CATALOG_MAX_CONTENT_BYTES } from "@jolly-pixel/asset-server";
import {
  bytesSource,
  servo
} from "@openally/servo";

// Import Internal Dependencies
import type { Middleware } from "../../http/node/Middleware.ts";
import {
  PROJECT_MANIFEST_FILE,
  ProjectManifest
} from "../ProjectManifest.ts";
import { kindOptionSections } from "./kindOptionSections.ts";
import type { Project } from "./Project.ts";
import {
  assertOneOwnerPerComponent,
  readKindSceneComponents
} from "./kindSceneComponents.ts";
import { requestPathname } from "../../http/node/requestPathname.ts";

export class ManifestRoute {
  readonly source: string;
  readonly middleware: Middleware;

  constructor(
    project: Project
  ) {
    const kindPackages = project.kinds.packages.map((kindPackage) => {
      return {
        name: kindPackage.name,
        kinds: kindPackage.descriptors.map(({ kind }) => kind),
        configurable: kindOptionSections(
          kindPackage.optionsSchema,
          kindPackage.descriptors
        ).length > 0,
        sceneComponents: readKindSceneComponents(
          kindPackage.name,
          project.kinds.resolver
        )
      };
    });
    assertOneOwnerPerComponent(kindPackages);
    this.source = JSON.stringify(new ProjectManifest({
      editors: project.editors.descriptors(),
      kinds: project.editors.framePreviews(project.kinds.descriptors()),
      kindPackages,
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
        next();
      }
    };
  }
}
