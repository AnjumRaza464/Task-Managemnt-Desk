"use client";

import dynamic from "next/dynamic";

/** Loads three.js only on the login page, in the browser, after the page is interactive. */
export const LoginSceneLoader = dynamic(() => import("@/components/auth/login-scene").then((m) => m.LoginScene), {
  ssr: false,
  loading: () => null,
});
