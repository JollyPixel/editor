// CONSTANTS
const kGroupLabels = {
  foundation: "Foundation",
  peer: "Peer",
  controls: "Controls",
  containers: "Containers",
  data: "Data views",
  scenarios: "Scenarios",
  monitors: "Monitors",
  feedback: "Feedback",
  math: "Math"
} as const;

export type GalleryGroup = keyof typeof kGroupLabels;
export type GalleryExampleId = `${GalleryGroup}/${string}`;

export class UnknownGalleryGroupError extends Error {
  constructor(
    id: string
  ) {
    super(
      `Example id "${id}" has no group in [${Object.keys(kGroupLabels).join(", ")}]`
    );
  }
}

export function isGalleryGroup(
  value: string
): value is GalleryGroup {
  return Object.hasOwn(kGroupLabels, value);
}

export function groupLabelOf(
  id: string
): string {
  const [group] = id.split("/");
  if (!isGalleryGroup(group)) {
    throw new UnknownGalleryGroupError(id);
  }

  return kGroupLabels[group];
}
