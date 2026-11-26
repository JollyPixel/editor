// Import Third-party Dependencies
import { DEFAULT_CATALOG_MAX_CONTENT_BYTES } from "@jolly-pixel/asset-server";
import { sendPayload } from "@openally/servo";

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
import { readPathname } from "../../http/node/requestPathname.ts";

// CONSTANTS
const kJsonContentType = "application/json; charset=utf-8";

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
    this.middleware = (request, response, next) => {
      if (readPathname(request) === `/${PROJECT_MANIFEST_FILE}`) {
        sendPayload(request, response, {
          body: bytes,
          contentType: kJsonContentType,
          dev: true,
          etag: true
        }).catch(() => response.destroy());
      }
      else {
        next();
      }
    };
  }
}
