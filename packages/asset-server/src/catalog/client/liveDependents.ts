export interface DependentRecords<TRecord> {
  dependentsOf(
    assetId: string
  ): readonly string[];
  record(
    assetId: string
  ): TRecord | undefined;
}

export function liveDependents<TRecord>(
  source: DependentRecords<TRecord>,
  assetId: string
): TRecord[] {
  return source.dependentsOf(assetId).flatMap((dependentId) => {
    const record = source.record(dependentId);

    return record === undefined ? [] : [record];
  });
}
