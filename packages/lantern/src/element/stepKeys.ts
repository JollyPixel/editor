export type StepKeyAction = "next" | "back" | "skip";

export interface StepKeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

export function stepKeyAction(
  event: StepKeyInput
): StepKeyAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }

  switch (event.key) {
    case "ArrowRight":
    case "Enter":
      return "next";
    case "ArrowLeft":
      return "back";
    case "Escape":
      return "skip";
    default:
      return null;
  }
}
