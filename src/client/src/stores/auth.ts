// Import Third-party Dependencies
import { defineStore } from "pinia";

export const useAuthStore = defineStore("auth", {
  state() {
    return {
      authenticated: false
    };
  },
  actions: {
    isLoggedIn() {
      return this.authenticated;
    }
  }
});
