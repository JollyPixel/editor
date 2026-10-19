// Import Internal Dependencies
import type { Accumulator } from "../ReaderBuffer.ts";

export class TypedText implements Accumulator<TypedText> {
  value = "";

  get empty(): boolean {
    return this.value === "";
  }

  append(
    text: string
  ): void {
    this.value += text;
  }

  addTo(
    target: TypedText
  ): void {
    target.value += this.value;
  }

  clear(): void {
    this.value = "";
  }
}
