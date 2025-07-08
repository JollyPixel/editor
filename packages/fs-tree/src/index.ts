// Import Internal Dependencies
import { FSTree } from "./backend/FSTree.class.js";
import type { FSTreeFile } from "./backend/types.js";

interface CustomFSNode extends FSTreeFile {
  type: "script";
}

const fsTree = await FSTree.loadFromPath<CustomFSNode>(
  process.cwd(),
  (dirent) => {
    return {
      name: dirent.name,
      type: "script"
    };
  }
);
console.log(fsTree.toJSON());
// fsTree.on(FSTree.Event, (op) => {
//   console.log("tree updated op:", op);
// });

// fsTree.mvdir("/src/utils", "/src/helpers");
// fsTree.copy(
//   { parentPath: "/src", name: "types.ts" },
//   "/src/helpers"
// );

// console.log(
//   [...fsTree.readdir("/src", { recursive: true, absolutePath: true })]
// );
