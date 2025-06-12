// Import Third-party Dependencies
import {
  createRouter,
  createWebHistory
} from "vue-router";

// Import Internal Dependencies
import Home from "./components/views/Home.vue";
import Projects from "./components/views/Projects.vue";
import Login from "./components/views/Login.vue";

import { useAuthStore } from "./stores/auth.js";

const routes = [
  {
    path: "/",
    component: Home
  },
  {
    path: "/projects",
    component: Projects,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: "/login",
    component: Login
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to, _, next) => {
  const auth = useAuthStore();

  if (
    to.meta.requiresAuth &&
    !auth.isLoggedIn()
  ) {
    next("/login");
  }
  else {
    next();
  }
});

export default router;

declare module "vue-router" {
  interface RouteMeta {
    requiresAuth: boolean;
  }
}
