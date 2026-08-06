import { defineStore } from "pinia";
import * as authApi from "@/api/auth";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    accessToken: localStorage.getItem("access_token"),
  }),

  actions: {
    async register(form) {
      const data = await authApi.register(form);

      this.user = data.user;

      if (data.session) {
        this.accessToken = data.session.access_token;
        localStorage.setItem(
          "access_token",
          data.session.access_token
        );
      }

      return data;
    },

    async login(credentials) {
      const data = await authApi.login(credentials);

      this.user = data.user;
      this.accessToken = data.session.access_token;

      localStorage.setItem(
        "access_token",
        data.session.access_token
      );

      return data;
    },

    async logout() {
      await authApi.logout();

      this.user = null;
      this.accessToken = null;

      localStorage.removeItem("access_token");
    },
  },
});