import apiClient from "../../api/axios";
import type { Room } from "../../types/game";

export async function fetchAdminRooms(): Promise<Room[]> {
  const response = await apiClient.get<Room[]>("/rooms");
  return response.data;
}
