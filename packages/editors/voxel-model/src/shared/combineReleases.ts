export function combineReleases(
  releases: Array<() => void>
): () => void {
  return () => {
    for (const release of releases.splice(0)) {
      release();
    }
  };
}
