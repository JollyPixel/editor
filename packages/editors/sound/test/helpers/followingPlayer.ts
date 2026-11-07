// Import Third-party Dependencies
import { SoundDocument } from "@jolly-pixel/asset.sound/client";

// Import Internal Dependencies
import { SoundPlayer } from "#src/player/SoundPlayer.ts";
import { FakeAudioContext } from "./FakeAudioContext.ts";

// CONSTANTS
const kOggBytes = new Uint8Array([0x4F, 0x67, 0x67, 0x53]);

export async function followingPlayer(
  context = new FakeAudioContext()
): Promise<{
  context: FakeAudioContext;
  document: SoundDocument;
  player: SoundPlayer;
}> {
  const player = new SoundPlayer(context.asAudioContext());
  const document = new SoundDocument();
  document.load(kOggBytes);
  await player.follow(document);

  return {
    context,
    document,
    player
  };
}
