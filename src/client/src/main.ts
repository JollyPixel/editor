// Import Third-party Dependencies
import { createApp } from "vue";
import { createPinia } from "pinia";

// Import Internal Dependencies
import "./style.css";
import router from "./router.js";
import App from "./App.vue";

createApp(App)
  .use(createPinia())
  .use(router)
  .mount("#app");
