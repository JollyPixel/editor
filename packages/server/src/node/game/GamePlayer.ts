export interface PlayerPageSource {
  html(): Promise<string>;
}

export interface PlayerBundle {
  /**
   * The built `play/index.html`, which loads its files from `../`.
   */
  readonly page: string;
  /**
   * Every file the page loads, by path from the build root.
   */
  readonly files: ReadonlyMap<string, Uint8Array>;
}

export interface GamePlayer {
  bundle(): Promise<PlayerBundle>;
}
