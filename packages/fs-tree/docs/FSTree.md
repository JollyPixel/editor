# FSTree

Represents a file system tree, extending `EventEmitter` to emit events on file system changes.

## Signature

```typescript
class FSTree<T extends FSTreeFile = FSTreeFile> extends EventEmitter {
  constructor(dir: string | URL, options?: FSTreeOptions<T>);

  static loadFromPath<T extends FSTreeFile = FSTreeFile>(
    location: string | URL,
    fileMapFn?: FSTreeFileMap<T>
  ): Promise<FSTree<T>>;

  get root(): string;

  prevent(tagOrOmitNumber: number | NonNullable<FSTreeTag>): this;

  mkdir(location: string | FSTreeOptionalDirent): boolean;
  rmdir(location: string | FSTreeOptionalDirent): boolean;
  mvdir(
    location: string | FSTreeOptionalDirent,
    newLocation: string | FSTreeOptionalDirent
  ): boolean;

  append(dirent: FSTreeOptionalDirent, file?: T | null): boolean;
  update(
    dirent: FSTreeOptionalDirent,
    fileUpdateMapFn: FSTreeFileUpdateMap<T>
  ): boolean;
  unlink(dirent: FSTreeOptionalDirent): T | null;
  copy(
    dirent: FSTreeOptionalDirent,
    newLocation: string | FSTreeOptionalDirent
  ): boolean;

  readdir(
    location: string,
    options?: { recursive?: boolean; absolutePath?: boolean }
  ): Iterable<T>;
}
```

## Usage example

```typescript
import { FSTree } from "./FSTree.class.ts";

const tree = await FSTree.loadFromPath("/path/to/another/directory");

// Example: Creating a directory
tree.mkdir("new-directory");

// Example: Appending a file
tree.append({ name: "new-file.txt", parentPath: "new-directory/" });
```

## Methods

## constructor(dir: string | URL, options: FSTreeOptions\<T\> = {})

Creates a new `FSTree` instance, initializing the tree with the given root directory.

## static async loadFromPath\<T extends FSTreeFile = FSTreeFile\>(location: string | URL, fileMapFn?: FSTreeFileMap\<T\>): Promise\<FSTree\<T\>\>

Asynchronously loads a file tree from a specified path. This static method is useful for initializing an `FSTree` instance from an existing directory structure.

## get root(): string

Returns the absolute path of the root directory managed by this `FSTree` instance.

## prevent(tagOrOmitNumber: number | NonNullable\<FSTreeTag\>): this

Prevents the emission of events for a specified number of operations or for operations associated with a given tag. This can be useful for batch operations where you only want to emit events once at the end.

## mkdir(location: string | FSTreeOptionalDirent): boolean

Creates a new directory within the tree. Returns `true` if the directory was created, `false` otherwise (e.g., if it already exists).

## rmdir(location: string | FSTreeOptionalDirent): boolean

Deletes an existing directory from the tree. Returns `true` if the directory was deleted, `false` otherwise.

## mvdir(location: string | FSTreeOptionalDirent, newLocation: string | FSTreeOptionalDirent): boolean

Moves a directory from one location to another within the tree. Returns `true` if the move was successful, `false` otherwise.

## append(dirent: FSTreeOptionalDirent, file?: T | null): boolean

Adds a file or directory entry (`dirent`) to the tree. If `file` is provided, it will be associated with the `dirent`. Returns `true` if the entry was added, `false` otherwise.

## update(dirent: FSTreeOptionalDirent, fileUpdateMapFn: FSTreeFileUpdateMap\<T\>): boolean

Updates an existing file in the tree using a provided `fileUpdateMapFn`. This function receives the current file object and should return the updated file object. Returns `true` if the file was updated, `false` otherwise.

## unlink(dirent: FSTreeOptionalDirent): T | null

Removes a file from the tree. Returns the removed file object if successful, `null` otherwise.

## copy(dirent: FSTreeOptionalDirent, newLocation: string | FSTreeOptionalDirent): boolean

Copies a file from its current location to a new location within the tree. Returns `true` if the copy was successful, `false` otherwise.

## \* readdir(location: string, options: { recursive?: boolean; absolutePath?: boolean; } = {}): Iterable\<T\>

Reads the contents of a directory within the tree. Can optionally read recursively and return absolute paths. Returns an iterable of `FSTreeFile` objects.
