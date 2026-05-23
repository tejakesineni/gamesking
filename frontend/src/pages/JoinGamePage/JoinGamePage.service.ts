import apiClient from "../../api/axios";
import type { RoomUser } from "../../types/game";

type JoinRoomPayload = {
  roomCode: string;
  playerName: string;
};

export async function joinRoom(payload: JoinRoomPayload): Promise<RoomUser> {
  const response = await apiClient.post<RoomUser>("/rooms/join", payload);
  return response.data;
}
