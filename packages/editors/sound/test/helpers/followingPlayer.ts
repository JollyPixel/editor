// Import Third-party Dependencies
import { SoundDocument } from "@jolly-pixel/asset.sound/client";

// Import Internal Dependencies
import { SoundPlayer } from "#src/player/SoundPlayer.ts";
import { LiveSettings } from "#src/settings/LiveSettings.ts";
import { FakeAudioContext } from "./FakeAudioContext.ts";
import { TestSoundAccess } from "./soundAccess.ts";

// CONSTANTS
const kOggBytes = new Uint8Array([0x4F, 0x67, 0x67, 0x53]);

export async function followingPlayer(
  context = new FakeAudioContext()
): Promise<{
  context: FakeAudioContext;
  document: SoundDocument;
  access: TestSoundAccess;
  settings: LiveSettings;
  player: SoundPlayer;
}> {
  const player = new SoundPlayer(context.asAudioContext());
  const document = new SoundDocument();
  document.load(kOggBytes);
  const access = new TestSoundAccess();
  const settings = new LiveSettings(document, access);
  await player.follow(settings);

  return {
    context,
    document,
    access,
    settings,
    player
  };
}
