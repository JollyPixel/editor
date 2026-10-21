export type TourKeyLabels = (
  action: string
) => readonly string[] | undefined;

export class TourKeys {
  #sources = new Map<string, TourKeyLabels>();

  provide(
    namespace: string,
    labels: TourKeyLabels
  ): () => void {
    this.#sources.set(namespace, labels);

    return () => {
      if (this.#sources.get(namespace) === labels) {
        this.#sources.delete(namespace);
      }
    };
  }

  labels(
    name: string
  ): readonly string[] | undefined {
    const separator = name.indexOf(".");
    if (separator <= 0) {
      return undefined;
    }

    return this.#sources.get(name.slice(0, separator))?.(
      name.slice(separator + 1)
    );
  }
}
