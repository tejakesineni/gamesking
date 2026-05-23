export type RoomStatus = "waiting" | "live" | "finished";

export type Room = {
  id: string;
  name: string;
  hostName: string;
  roomCode: string;
  status: RoomStatus;
  maxPlayers: number;
  playersJoined: number;
  createdAt: string;
};

export type BingoColumn = {
  label: string;
  values: Array<number | "FREE">;
};

export type NewGameFormState = {
  name: string;
  hostName: string;
  maxPlayers: number;
};

export type JoinGameFormState = {
  roomCode: string;
  playerName: string;
};
