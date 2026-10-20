export type Immutable<TValue> = TValue extends readonly (infer TItem)[] ?
  readonly Immutable<TItem>[] :
  TValue extends object ?
    { readonly [TKey in keyof TValue]: Immutable<TValue[TKey]> } :
    TValue;

export type Without<TValue, TKey extends PropertyKey> = TValue extends unknown ?
  Omit<TValue, TKey> :
  never;
