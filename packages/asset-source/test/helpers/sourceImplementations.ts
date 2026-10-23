// Import Internal Dependencies
import {
  MemoryAssetSource,
  type AssetSource
} from "#src/index.ts";
import { FilesystemAssetSource } from "#src/node.ts";
import { IndexedDbAssetSource } from "#src/persistence/indexeddb/IndexedDbAssetSource.ts";
import { tempWorkspace } from "./tempWorkspace.ts";

export interface SourceFixture extends AsyncDisposable {
  readonly source: AssetSource;
}

export interface SourceImplementation {
  name: string;
  create(): Promise<SourceFixture>;
}

export const sourceImplementations: SourceImplementation[] = [
  {
    name: "MemoryAssetSource",
    create: () => Promise.resolve({
      source: new MemoryAssetSource(),
      [Symbol.asyncDispose]: () => Promise.resolve()
    })
  },
  {
    name: "FilesystemAssetSource",
    create: async() => {
      const workspace = await tempWorkspace();

      return {
        source: new FilesystemAssetSource(workspace.root),
        [Symbol.asyncDispose]: () => workspace[Symbol.asyncDispose]()
      };
    }
  },
  {
    name: "IndexedDbAssetSource",
    create: async() => {
      const source = await IndexedDbAssetSource.open({
        name: crypto.randomUUID()
      });

      return {
        source,
        [Symbol.asyncDispose]: () => Promise.resolve(source.close())
      };
    }
  }
];
