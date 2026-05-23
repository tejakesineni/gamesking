import apiClient from "../../api/axios";
import type { Room } from "../../types/game";

type CreateRoomPayload = {
  hostName: string;
  game: string;
};

export async function createRoom(payload: CreateRoomPayload): Promise<Room> {
  const response = await apiClient.post<Room>("/rooms", payload);
  return response.data;
}
