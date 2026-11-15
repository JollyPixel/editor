// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import type { Accounts } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import type { PlayerPageSource } from "./GamePlayer.ts";
import type { StudioGame } from "./StudioGame.ts";
import type { Middleware } from "../http/Middleware.ts";
import { readPathname } from "../http/requestPathname.ts";
import { sendHtml } from "../http/sendHtml.ts";
import { PLAY_PAGE_PATHNAMES } from "../../editors/EditorDescriptor.ts";
import { GAME_URL_PATH } from "../../game/api.ts";
import { PlayerPage } from "../../game/PlayerPage.ts";

// CONSTANTS
const kGameBase = `..${GAME_URL_PATH}`;
const kFailedPage = "<!doctype html><html lang=\"en\"><head>" +
  "<meta charset=\"utf-8\"><title>Player unavailable</title></head>" +
  "<body><p>The game player could not be loaded.</p></body></html>";

export interface PlayPageOptions {
  page: PlayerPageSource;
  game: Pick<StudioGame, "scriptImports">;
  accounts: Pick<Accounts, "signedIn">;
}

export class PlayPage {
  readonly middleware: Middleware;

  #page: PlayerPageSource;
  #game: Pick<StudioGame, "scriptImports">;

  constructor(
    options: PlayPageOptions
  ) {
    this.#page = options.page;
    this.#game = options.game;
    this.middleware = (request, response, next) => {
      const pathname = readPathname(request);
      if (pathname === null || !PLAY_PAGE_PATHNAMES.has(pathname)) {
        next();

        return;
      }

      this.render(options.accounts.signedIn(request.headers)).then(
        (html) => sendHtml(response, 200, html),
        () => sendHtml(response, 500, kFailedPage)
      );
    };
  }

  async render(
    account: Account | null
  ): Promise<string> {
    const page = PlayerPage.parse(await this.#page.html());

    return account === null ?
      page.toString() :
      page.withImports(this.#game.scriptImports(account, kGameBase)).toString();
  }
}
