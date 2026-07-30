/**
 * Compiles a glob pattern into a RegExp. Only "*" is special (matches
 * anything, including "."); every other character, including ".", is literal.
 *
 * @example
 * compileGlobPattern("voxel.renderer.*").test("voxel.renderer.voxel-set"); // true
 * compileGlobPattern("voxel.renderer.*").test("voxel.other.voxel-set"); // false
 */
export function compileGlobPattern(
  pattern: string
): RegExp {
  const escaped = pattern
    .split("*")
    .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");

  return new RegExp(`^${escaped}$`);
}
