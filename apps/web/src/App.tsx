import { useCallback, useState } from "react";
import { useRoute } from "./app/useRoute";
import { FloatingToastStack, type ToastItem, type ToastTone } from "./components/game-ui";
import { HomePage } from "./pages/HomePage";
import { RoomPage } from "./pages/RoomPage";

export function App() {
  const { route, navigateHome, navigateRoom } = useRoute();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback((message: string, tone: ToastTone = "info") => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <>
      <FloatingToastStack toasts={toasts} onDismiss={dismissToast} />

      {route.name === "room" ? (
        <RoomPage
          roomCode={route.roomCode}
          onExitHome={navigateHome}
          onNotify={notify}
        />
      ) : (
        <HomePage onEnterRoom={navigateRoom} onNotify={notify} />
      )}
    </>
  );
}
