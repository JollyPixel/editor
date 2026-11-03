export interface TokenizedLine<TToken, TState> {
  readonly tokens: readonly TToken[];
  readonly state: TState;
}

export interface LineTokenizer<TToken, TState> {
  tokenize(
    line: string,
    state: TState | null
  ): TokenizedLine<TToken, TState>;
  sameState(
    left: TState,
    right: TState
  ): boolean;
}

interface CachedLine<TToken, TState> extends TokenizedLine<TToken, TState> {
  readonly text: string;
}

export class LineTokenCache<TToken, TState> {
  #tokenizer: LineTokenizer<TToken, TState>;
  #lines: CachedLine<TToken, TState>[] = [];
  #tokenized = 0;

  constructor(
    tokenizer: LineTokenizer<TToken, TState>
  ) {
    this.#tokenizer = tokenizer;
  }

  get tokenizedLines(): number {
    return this.#tokenized;
  }

  update(
    lines: readonly string[]
  ): void {
    const previous = this.#lines;
    let prefix = 0;
    while (
      prefix < lines.length &&
      prefix < previous.length &&
      lines[prefix] === previous[prefix].text
    ) {
      prefix++;
    }
    let suffix = 0;
    while (
      suffix < lines.length - prefix &&
      suffix < previous.length - prefix &&
      lines[lines.length - 1 - suffix] === previous[previous.length - 1 - suffix].text
    ) {
      suffix++;
    }

    const next = previous.slice(0, prefix);
    this.#tokenized = 0;
    let state: TState | null = next.at(-1)?.state ?? null;
    for (let index = prefix; index < lines.length; index++) {
      const reusable = index >= lines.length - suffix ?
        previous[index - lines.length + previous.length] :
        undefined;
      const tokenized = this.#tokenizer.tokenize(lines[index], state);
      this.#tokenized++;
      next.push({
        text: lines[index],
        ...tokenized
      });
      state = tokenized.state;
      if (
        reusable !== undefined &&
        this.#tokenizer.sameState(reusable.state, tokenized.state)
      ) {
        next.push(...previous.slice(index - lines.length + previous.length + 1));
        break;
      }
    }
    this.#lines = next;
  }

  tokens(
    line: number
  ): readonly TToken[] | null {
    return this.#lines[line]?.tokens ?? null;
  }
}
