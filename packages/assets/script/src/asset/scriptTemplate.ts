// Import Third-party Dependencies
import type { AssetPath } from "@jolly-pixel/asset";

// CONSTANTS
const kBehaviorSuffix = "Behavior";
const kDefaultStem = "New";
const kNameWords = /[\p{L}\p{Nd}]+/gu;
const kLeadingDigit = /^\p{Nd}/u;

export function scriptTemplate(
  path: AssetPath | undefined
): string {
  return `import { Behavior } from "@jolly-pixel/ecs";

export class ${behaviorName(path)} extends Behavior {
  // Runs once, when the scene starts or when the actor is added.
  awake() {
  }

  // Runs once, on the first frame after the behavior is created.
  start() {
  }
}
`;
}

function behaviorName(
  path: AssetPath | undefined
): string {
  const words = path?.name.match(kNameWords) ?? [];
  const name = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  const stem = name.endsWith(kBehaviorSuffix) ?
    name.slice(0, -kBehaviorSuffix.length) :
    name;
  if (stem === "") {
    return `${kDefaultStem}${kBehaviorSuffix}`;
  }

  return kLeadingDigit.test(stem) ?
    `_${stem}${kBehaviorSuffix}` :
    `${stem}${kBehaviorSuffix}`;
}
