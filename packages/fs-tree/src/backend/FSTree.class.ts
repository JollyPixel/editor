// Import Node.js Dependencies
import path from "node:path";
import { EventEmitter } from "node:events";
import { Dirent, promises as fs } from "node:fs";

// Import Third-party Dependencies
import {
  DiGraph,
  type VertexDefinition
} from "digraph-js";
import lodashSet from "lodash.set";

// Import Internal Dependencies
import { FSTreeRootDirectory } from "./FSTreeRootDirectory.class.js";
import type {
  FSTreeFile,
  FSTreeTag,
  FSTreeVertex,
  FSTreeDirent,
  FSTreeOptionalDirent,
  FSTreeFsOperations
} from "./types.js";

export type FSTreeFileMap<
  T extends FSTreeFile = FSTreeFile
> = (dirent: Dirent | FSTreeDirent | FSTreeOptionalDirent) => T;

export type FSTreeFileUpdateMap<
  T extends FSTreeFile = FSTreeFile
> = (file: T) => T;

export interface FSTreeOptions<
  T extends FSTreeFile = FSTreeFile
> {
  dirents?: (Dirent | FSTreeDirent)[];
  fileMapFn?: FSTreeFileMap<T>;
}

export class FSTree<T extends FSTreeFile = FSTreeFile> extends EventEmitter<
  { [FSTree.Event]: [FSTreeFsOperations<T>, string | null]; }
> {
  static readonly Event = Symbol.for("FSTree.Event");

  #treeRootDirectory: FSTreeRootDirectory;
  #fileMapFn: FSTreeFileMap<T>;
  #numberOfEventsToOmit = 0;
  #tags: FSTreeTag[] = [];
  #tree = new DiGraph<VertexDefinition<FSTreeVertex<T>>>();

  static async loadFromPath<T extends FSTreeFile = FSTreeFile>(
    location: string | URL,
    fileMapFn?: FSTreeFileMap<T>
  ): Promise<FSTree<T>> {
    const dirents = await fs.readdir(location, {
      withFileTypes: true,
      recursive: true
    });

    return new FSTree(location, {
      dirents,
      fileMapFn
    });
  }

  constructor(
    dir: string | URL,
    options: FSTreeOptions<T> = {}
  ) {
    super();
    const {
      dirents = [],
      fileMapFn = noopFileMapFn
    } = options;

    this.#treeRootDirectory = new FSTreeRootDirectory(
      dir
    );
    this.#fileMapFn = fileMapFn as unknown as FSTreeFileMap<T>;
    this.#tree.addVertex(
      initVertex(path.sep)
    );
    dirents.forEach((dirent) => {
      this.mkdir(dirent.parentPath);
      isFile(dirent) && this.append(dirent);
    });
  }

  get root() {
    return this.#treeRootDirectory.value;
  }

  prevent(
    tagOrOmitNumber: number | NonNullable<FSTreeTag>
  ) {
    if (typeof tagOrOmitNumber === "number") {
      this.#numberOfEventsToOmit += tagOrOmitNumber;
    }
    else {
      this.#tags.push(tagOrOmitNumber);
    }

    return this;
  }

  #supervizedEmitEvent(
    fsOperation: FSTreeFsOperations<T>
  ) {
    if (this.#numberOfEventsToOmit > 0) {
      this.#numberOfEventsToOmit--;

      return;
    }

    const tagName: FSTreeTag = this.#tags?.shift() ?? null;
    this.emit(FSTree.Event, fsOperation, tagName);
  }

  #resolveVertexId(
    location: string | FSTreeDirent | FSTreeOptionalDirent | Dirent
  ): string {
    if (typeof location !== "string") {
      return this.#resolveVertexId(location.parentPath);
    }

    if (path.isAbsolute(location)) {
      return this.#treeRootDirectory.normalize(location);
    }

    return path.normalize(
      path.sep +
      location
        .replace(/^\//, "")
        .replace(/\/$/, "")
    );
  }

  #getVertex(
    vertexId: string
  ): FSTreeVertex<T> | null {
    let vertex: FSTreeVertex | null = null;

    this.#tree.mergeVertexBody(vertexId, (body) => {
      vertex = body;
    });

    return vertex;
  }

  mkdir(
    location: string | FSTreeOptionalDirent
  ): boolean {
    const vertexId = this.#resolveVertexId(location);
    if (this.#tree.hasVertex(vertexId)) {
      return false;
    }

    this.#tree.addVertex(initVertex(vertexId));
    this.#tree.addEdge({
      from: path.dirname(vertexId),
      to: vertexId
    });
    this.#supervizedEmitEvent({
      action: "mkdir",
      from: vertexId
    });

    return true;
  }

  rmdir(
    location: string | FSTreeOptionalDirent
  ): boolean {
    const vertexId = this.#resolveVertexId(location);
    if (this.#tree.hasVertex(vertexId)) {
      this.#tree.deleteVertex(vertexId);
      this.#supervizedEmitEvent({
        action: "rmdir",
        from: vertexId
      });

      return true;
    }

    return false;
  }

  mvdir(
    location: string | FSTreeOptionalDirent,
    newLocation: string | FSTreeOptionalDirent
  ): boolean {
    const currentVertexId = this.#resolveVertexId(location);
    if (!this.#tree.hasVertex(currentVertexId)) {
      return false;
    }

    this.mkdir(newLocation);
    const { files } = this.#getVertex(currentVertexId)!;

    this.#tree.deleteEdge({
      from: path.dirname(currentVertexId),
      to: currentVertexId
    });
    this.#tree.deleteVertex(currentVertexId);

    const newVertexId = this.#resolveVertexId(newLocation);
    const newVertex = this.#getVertex(newVertexId)!;
    newVertex.files = files;

    this.#supervizedEmitEvent({
      action: "mvdir",
      from: currentVertexId,
      to: newVertexId
    });

    return true;
  }

  append(
    dirent: FSTreeOptionalDirent,
    file?: T | null
  ) {
    const vertexId = this.#resolveVertexId(dirent.parentPath);
    if (!this.#tree.hasVertex(vertexId)) {
      return false;
    }

    const fileToAppend = file ?? this.#fileMapFn(dirent);
    this.#tree.mergeVertexBody(vertexId, (body) => {
      body.files.push(fileToAppend);
    });
    this.#supervizedEmitEvent({
      action: "append",
      file: fileToAppend
    });

    return true;
  }

  update(
    dirent: FSTreeOptionalDirent,
    fileUpdateMapFn: FSTreeFileUpdateMap<T>
  ) {
    const vertexId = this.#resolveVertexId(dirent.parentPath);
    const vertex = this.#getVertex(vertexId);
    if (!vertex) {
      return false;
    }

    const fileIndex = vertex.files.findIndex((file) => file.name === dirent.name);
    if (fileIndex === -1) {
      return false;
    }

    const current = vertex.files[fileIndex];
    const previousFile = structuredClone(current);

    this.#supervizedEmitEvent({
      action: "update",
      previousFile,
      file: fileUpdateMapFn(current)
    });

    return true;
  }

  unlink(
    dirent: FSTreeOptionalDirent
  ): T | null {
    const vertexId = this.#resolveVertexId(dirent.parentPath);
    const vertex = this.#getVertex(vertexId);
    if (!vertex) {
      return null;
    }

    const fileIndex = vertex.files.findIndex((file) => file.name === dirent.name);
    if (fileIndex === -1) {
      return null;
    }

    const [file] = vertex.files.splice(fileIndex, 1);
    this.#supervizedEmitEvent({
      action: "unlink",
      file
    });

    return file;
  }

  copy(
    dirent: FSTreeOptionalDirent,
    newLocation: string | FSTreeOptionalDirent
  ): boolean {
    const newVertexId = this.#resolveVertexId(newLocation);
    if (!this.#tree.hasVertex(newVertexId)) {
      return false;
    }

    const file = this.prevent(1).unlink(dirent);
    if (file === null) {
      this.#numberOfEventsToOmit--;
    }

    const newDirent = typeof newLocation === "string" ?
      { parentPath: newLocation, name: path.basename(dirent.name) } :
      newLocation;
    const fileAppend = this.prevent(1).append(newDirent, file);
    if (!fileAppend) {
      this.#numberOfEventsToOmit--;
    }

    this.#supervizedEmitEvent({
      action: "copy",
      from: path.join(dirent.parentPath, dirent.name),
      to: path.join(newDirent.parentPath, newDirent.name)
    });

    return true;
  }

  * readdir(
    location: string,
    options: { recursive?: boolean; absolutePath?: boolean; } = {}
  ): Iterable<T> {
    const { recursive = false, absolutePath = false } = options;
    const rootVertexId = this.#resolveVertexId(location);

    for (const vertex of this.#tree.traverse({ rootVertexId })) {
      if (!recursive && vertex.id !== rootVertexId) {
        break;
      }

      yield* structuredClone(vertex.body.files).map((file) => {
        file.name = absolutePath ?
          path.join(this.root, vertex.id, file.name) :
          path.join(vertex.id, file.name);

        return file;
      });
    }
  }

  toJSON() {
    const rootVertexId = this.#resolveVertexId("/");
    const data: Record<string, T | T[]> = {};

    for (const vertex of this.#tree.traverse({ rootVertexId })) {
      if (vertex.id === path.sep) {
        for (const file of vertex.body.files) {
          data[file.name] = file;
        }
      }
      else {
        const tempObject: Record<string, T | T[]> = {};
        for (const file of vertex.body.files) {
          tempObject[file.name] = file;
        }

        const vertexPath = vertex.id
          .split(path.sep)
          .filter((line) => line.trim() !== "")
          .join(".");
        lodashSet(data, vertexPath, tempObject);
      }
    }

    return data;
  }
}

function noopFileMapFn(
  dirent: Dirent | FSTreeDirent
): FSTreeFile {
  return { name: dirent.name };
}

function isFile(
  dirent: Dirent | FSTreeDirent
): boolean {
  return (dirent instanceof Dirent && dirent.isFile()) ||
    ("type" in dirent && dirent.type === "file");
}

function initVertex<T extends FSTreeFile = FSTreeFile>(
  id: string,
  files: T[] = []
): VertexDefinition<FSTreeVertex<T>> {
  return {
    id,
    adjacentTo: [],
    body: {
      files
    }
  };
}
