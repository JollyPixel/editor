export type Without<TValue, TKey extends PropertyKey> = TValue extends unknown ?
  Omit<TValue, TKey> :
  never;
