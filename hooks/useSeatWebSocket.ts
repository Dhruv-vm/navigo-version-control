"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export type SeatStatus = "available" | "selected" | "booked" | "locked";

export interface SeatUpdate {
  seatId: string;
  status: SeatStatus;
  userId?: string;
  lockedUntil?: number; // timestamp
}

export interface WebSocketMessage {
  type: "seat_update" | "bulk_update" | "lock_seat" | "unlock_seat" | "init";
  payload: SeatUpdate | SeatUpdate[] | { seatId: string; userId: string };
}

interface UseSeatWebSocketOptions {
  flightId: string;
  cabinClass: string;
  userId: string;
  onSeatUpdate: (update: SeatUpdate) => void;
  onBulkUpdate: (updates: SeatUpdate[]) => void;
}

export function useSeatWebSocket({
  flightId,
  cabinClass,
  userId,
  onSeatUpdate,
  onBulkUpdate,
}: UseSeatWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    // In production, replace with your actual WS server URL
    // e.g. const wsUrl = `wss://api.navigo.com/ws/seats/${flightId}/${cabinClass}`;
    const wsUrl = `ws://localhost:8080/ws/seats/${flightId}/${cabinClass}?userId=${userId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log("[WS] Connected to seat map");
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          if (message.type === "seat_update") {
            onSeatUpdate(message.payload as SeatUpdate);
          } else if (message.type === "bulk_update" || message.type === "init") {
            onBulkUpdate(message.payload as SeatUpdate[]);
          }
        } catch (err) {
          console.error("[WS] Failed to parse message:", err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log("[WS] Disconnected. Reconnecting in 3s...");
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error("[WS] Error:", err);
        ws.close();
      };
    } catch (err) {
      console.error("[WS] Failed to connect:", err);
      // Reconnect after 3s if connection fails
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    }
  }, [flightId, cabinClass, userId, onSeatUpdate, onBulkUpdate]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const lockSeat = useCallback((seatId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type: "lock_seat",
        payload: { seatId, userId },
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, [userId]);

  const unlockSeat = useCallback((seatId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type: "unlock_seat",
        payload: { seatId, userId },
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, [userId]);

  return { isConnected, lockSeat, unlockSeat };
}