import { useCallback, useEffect, useState } from "react";

export type AppRoute =
  | { name: "home" }
  | { name: "room"; roomCode: string };

function parseLocation(): AppRoute {
  const match = window.location.pathname.match(/^\/room\/([A-Za-z0-9]{4,6})\/?$/);
  if (match?.[1]) {
    return { name: "room", roomCode: match[1].toUpperCase() };
  }
  return { name: "home" };
}

export function useRoute() {
  const [route, setRoute] = useState<AppRoute>(() => parseLocation());

  useEffect(() => {
    const handlePop = () => setRoute(parseLocation());
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const navigateHome = useCallback(() => {
    window.history.pushState({}, "", "/");
    setRoute({ name: "home" });
  }, []);

  const navigateRoom = useCallback((roomCode: string) => {
    const clean = roomCode.trim().toUpperCase();
    window.history.pushState({}, "", `/room/${clean}`);
    setRoute({ name: "room", roomCode: clean });
  }, []);

  return { route, navigateHome, navigateRoom };
}
