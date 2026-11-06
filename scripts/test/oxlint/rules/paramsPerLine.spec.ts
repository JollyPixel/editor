// Import Internal Dependencies
import { paramsPerLine } from "../../../oxlint/rules/paramsPerLine.ts";
import { ruleTester } from "../../helpers/ruleTester.ts";

ruleTester.run("params-per-line", paramsPerLine, {
  valid: [
    "function move(x: number, y: number): void {}",
    "function move(\n  x: number,\n  y: number,\n  z: number\n): void {}",
    "class Box { resize(\n  width: number,\n  height: number,\n  depth: number\n) {} }",
    "const sum = [1, 2].reduce((total, value, index) => total + value + index, 0);"
  ],
  invalid: [
    {
      code: "function move(x: number, y: number, z: number): void {}",
      errors: 1
    },
    {
      code: "class Box { constructor(width: number, height: number, depth: number) {} }",
      errors: 1
    },
    {
      code: "interface Mover { move(x: number, y: number, z: number): void; }",
      errors: 1
    },
    {
      code: "declare function move(x: number,\n  y: number, z: number): void;",
      errors: 1
    },
    {
      code: "abstract class Shape { abstract scale(x: number, y: number, z: number): void; }",
      errors: 1
    }
  ]
});
