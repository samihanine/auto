import {
  createHashHistory,
  createMemoryHistory,
  createRouter as createTanStackRouter,
} from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const isSingleFile = import.meta.env.VITE_SINGLE_FILE === "1";

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    ...(isSingleFile
      ? {
          history:
            typeof document === "undefined"
              ? createMemoryHistory({ initialEntries: ["/"] })
              : createHashHistory(),
        }
      : {}),
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
