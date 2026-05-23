import apiClient from "../../api/axios";
import { io, type Socket } from "socket.io-client";
import type { Room, RoomStatus, WaitingRoomDetails } from "../../types/game";

const socketBaseUrl =
  import.meta.env.VITE_WS_BASE_URL ??
  import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, "") ??
  window.location.origin;

export async function fetchWaitingRoom(
  roomCode: string,
): Promise<WaitingRoomDetails> {
  const response = await apiClient.get<WaitingRoomDetails>(
    `/rooms/${roomCode}`,
  );

  return response.data;
}

export async function startRoom(
  roomCode: string,
  hostName: string,
): Promise<Room> {
  const response = await apiClient.post<Room>(`/rooms/${roomCode}/start`, {
    hostName,
  });

  return response.data;
}

export function connectWaitingRoomSocket(
  roomCode: string,
  playerName?: string,
): Socket {
  return io(socketBaseUrl, {
    query: {
      roomCode,
      ...(playerName ? { playerName } : {}),
    },
  });
}

export type RoomUserJoinedEvent = {
  roomCode: string;
  playerName: string;
  joinedAt: string;
};

export type RoomStartedEvent = {
  roomCode: string;
  status: RoomStatus;
};
