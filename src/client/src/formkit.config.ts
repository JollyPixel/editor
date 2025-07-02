// Import Third-party Dependencies
import { fr } from "@formkit/i18n";
import { defaultConfig } from "@formkit/vue";
import { genesisIcons } from "@formkit/icons";
import "@formkit/themes/genesis";

export default defaultConfig({
  locales: { fr },
  locale: "fr",
  theme: "genesis",
  icons: {
    ...genesisIcons
  }
});
