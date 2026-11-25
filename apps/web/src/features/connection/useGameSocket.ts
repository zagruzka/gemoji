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
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let pongTimeout: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const clearHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (pongTimeout) {
        clearTimeout(pongTimeout);
        pongTimeout = null;
      }
    };

    const connect = () => {
      if (!active) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setStatus("disconnected");
        return;
      }
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
        clearHeartbeat();
        heartbeatTimer = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          try {
            ws.send(JSON.stringify({ type: "PING", payload: {} }));
            if (pongTimeout) clearTimeout(pongTimeout);
            pongTimeout = setTimeout(() => {
              // Server did not respond to PING in time -> force reconnect
              if (wsRef.current === ws) {
                setStatus("disconnected");
                ws.close();
              }
            }, 4000);
          } catch {
            ws.close();
          }
        }, 5000);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(String(event.data)) as ServerMessage;
          if (parsed.type === "PONG") {
            if (pongTimeout) {
              clearTimeout(pongTimeout);
              pongTimeout = null;
            }
            return;
          }
          if (parsed.type === "SESSION_READY") {
            localStorage.setItem(TOKEN_STORAGE_KEY, parsed.payload.sessionToken);
          }
          onMessageRef.current(parsed);
        } catch {
          // Ignore malformed server payload
        }
      };

      ws.onclose = () => {
        clearHeartbeat();
        if (!active) return;
        setStatus("disconnected");
        if (typeof navigator !== "undefined" && navigator.onLine === false) return;
        const delay = Math.min(5000, 600 * Math.pow(1.6, attempt++));
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    const handleOffline = () => {
      clearHeartbeat();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      setStatus("disconnected");
      wsRef.current?.close();
    };

    const handleOnline = () => {
      if (!active) return;
      attempt = 0;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connect();
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    connect();

    return () => {
      active = false;
      clearHeartbeat();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
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
