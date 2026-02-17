export type DeepRequired<T> = Required<{
  [K in keyof T]: T[K] extends Required<T[K]> ? T[K] : DeepRequired<T[K]>
}>;

export type NonEmptyArray<T> = [T, ...T[]];
