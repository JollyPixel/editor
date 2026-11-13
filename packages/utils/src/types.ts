export type DistributiveOmit<TValue, TKey extends PropertyKey> =
  TValue extends unknown ? Omit<TValue, TKey> : never;

export type DeepReadonly<TValue> =
  TValue extends Uint8Array | ((...args: never[]) => unknown) ?
    TValue :
    TValue extends object ?
      { readonly [TKey in keyof TValue]: DeepReadonly<TValue[TKey]> } :
      TValue;

export type Simplify<TValue> = { [TKey in keyof TValue]: TValue[TKey] } & {};
