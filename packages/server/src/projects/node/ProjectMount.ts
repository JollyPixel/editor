// Import Internal Dependencies
import {
  PROJECT_PAGES_PREFIX,
  PROJECTS_PAGE_DIR
} from "../api.ts";

// CONSTANTS
const kPrefixedPath = /^\/p\/([^/]+)(\/.*)?$/;

export interface ProjectLocation {
  slug: string;
  /**
   * The request path inside the project, starting with "/". Empty when the
   * request names the project without its trailing slash.
   */
  pathname: string;
}

export interface ProjectMount {
  /**
   * Fastify prefix of the project API, with a `:slug` parameter when the
   * mount reads the slug from the path.
   */
  readonly routePrefix: string;
  /**
   * Where a request for "/" goes, or `null` when the project answers it.
   */
  readonly home: string | null;
  locate(pathname: string): ProjectLocation | null;
}

export class RootMount implements ProjectMount {
  readonly routePrefix = "";
  readonly home = null;

  #slug: string;

  constructor(
    slug: string
  ) {
    this.#slug = slug;
  }

  locate(
    pathname: string
  ): ProjectLocation {
    return {
      slug: this.#slug,
      pathname
    };
  }
}

export class PrefixMount implements ProjectMount {
  readonly routePrefix = `${PROJECT_PAGES_PREFIX}:slug`;
  readonly home = `/${PROJECTS_PAGE_DIR}/`;

  locate(
    pathname: string
  ): ProjectLocation | null {
    const match = kPrefixedPath.exec(pathname);
    if (match === null) {
      return null;
    }

    return {
      slug: match[1],
      pathname: match[2] ?? ""
    };
  }
}
