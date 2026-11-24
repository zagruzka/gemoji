import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage } from "@gemoji/shared";

const TOKEN_STORAGE_KEY = "gemoji_guest_token";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useGameSocket(onMessage: (msg: ServerMessage) => void) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const connect = () => {
      if (!active) return;
      setStatus("connecting");

      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const query = token ? `?token=${encodeURIComponent(token)}` : "";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws${query}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!active) return;
        attempt = 0;
        setStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as ServerMessage;
          if (parsed.type === "SESSION_READY") {
            localStorage.setItem(TOKEN_STORAGE_KEY, parsed.payload.sessionToken);
          }
          onMessageRef.current(parsed);
        } catch {
          // Ignore malformed server payload
        }
      };

      ws.onclose = () => {
        if (!active) return;
        setStatus("disconnected");
        const delay = Math.min(5000, 600 * Math.pow(1.6, attempt++));
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const send = useCallback((message: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  return { status, send };
}
