// Import Third-party Dependencies
import { createApp } from "vue";
import { createPinia } from "pinia";
import * as FormKit from "@formkit/vue";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

// Import Internal Dependencies
import "./style.css";
import formkitConfig from "./formkit.config.js";
import router from "./router.js";
import App from "./App.vue";

createApp(App)
  .use(createPinia())
  .use(router)
  .use(FormKit.plugin, FormKit.defaultConfig(formkitConfig))
  .mount("#app");
