export class LatestQuestion {
  #text: () => string;
  #asked = 0;

  constructor(
    text: () => string
  ) {
    this.#text = text;
  }

  ask<TAnswer>(
    question: (text: string) => Promise<TAnswer>,
    answer: (value: TAnswer, text: string) => void
  ): void {
    const asked = ++this.#asked;
    const text = this.#text();
    question(text).then(
      (value) => {
        if (asked === this.#asked && text === this.#text()) {
          answer(value, text);
        }
      },
      () => undefined
    );
  }

  cancel(): void {
    this.#asked++;
  }
}
