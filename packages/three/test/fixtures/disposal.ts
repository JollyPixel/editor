export interface DisposableResource {
  addEventListener(
    type: "dispose",
    listener: () => void
  ): void;
}

export function watchDisposal(
  ...resources: Array<DisposableResource | undefined>
): number[] {
  const counts = resources.map(() => 0);
  resources.forEach((resource, index) => {
    resource?.addEventListener("dispose", () => {
      counts[index]++;
    });
  });

  return counts;
}
