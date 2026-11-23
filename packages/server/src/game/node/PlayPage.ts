// Import Third-party Dependencies
import type { Member } from "@jolly-pixel/accounts";
import type { AccountsRealm } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import type { PlayerPageSource } from "../GamePlayer.ts";
import type { ProjectGame } from "./ProjectGame.ts";
import type { Middleware } from "../../http/node/Middleware.ts";
import { readPathname } from "../../http/node/requestPathname.ts";
import { sendHtml } from "../../http/node/sendHtml.ts";
import { PLAY_PAGE_PATHNAMES } from "../../editors/EditorDescriptor.ts";
import { PlayerPage } from "../PlayerPage.ts";

// CONSTANTS
const kFailedPage = "<!doctype html><html lang=\"en\"><head>" +
  "<meta charset=\"utf-8\"><title>Player unavailable</title></head>" +
  "<body><p>The game player could not be loaded.</p></body></html>";

export interface PlayPageOptions {
  page: PlayerPageSource;
  game: Pick<ProjectGame, "playable">;
  realm: Pick<AccountsRealm, "signedIn">;
}

export class PlayPage {
  readonly middleware: Middleware;

  #page: PlayerPageSource;
  #game: Pick<ProjectGame, "playable">;

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

      this.render(options.realm.signedIn(request.headers)).then(
        (html) => sendHtml(response, 200, html),
        () => sendHtml(response, 500, kFailedPage)
      );
    };
  }

  async render(
    account: Member | null
  ): Promise<string> {
    const html = await this.#page.html();

    return account === null ?
      PlayerPage.parse(html).toString() :
      this.#game.playable(account).playPage(html);
  }
}
