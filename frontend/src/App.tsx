import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";
import AppRoutes from "./routes/AppRoutes";
import type {
  BingoColumn,
  JoinGameFormState,
  NewGameFormState,
  Room,
  RoomStatus,
} from "./types/game";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api";

const statusCopy: Record<RoomStatus, string> = {
  waiting: "Lobby open",
  live: "Numbers rolling",
  finished: "Round closed",
};

function buildBingoBoard(): BingoColumn[] {
  return ["B", "I", "N", "G", "O"].map((label, columnIndex) => {
    const start = columnIndex * 15 + 1;
    const values = Array.from({ length: 15 }, (_, index) => start + index);

    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const current = values[index];
      values[index] = values[swapIndex];
      values[swapIndex] = current;
    }

    const selectedValues: Array<number | "FREE"> = values
      .slice(0, 5)
      .sort((left, right) => left - right);

    if (label === "N") {
      selectedValues[2] = "FREE";
    }

    return {
      label,
      values: selectedValues,
    };
  });
}

function App() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [boardPreview, setBoardPreview] = useState<BingoColumn[]>(() =>
    buildBingoBoard(),
  );
  const [formState, setFormState] = useState<NewGameFormState>({
    name: "Sunrise Social",
    hostName: "Priya",
    maxPlayers: 10,
  });
  const [joinState, setJoinState] = useState<JoinGameFormState>({
    roomCode: "",
    playerName: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const liveRooms = rooms.filter((room) => room.status === "live").length;
  const seatsOpen = rooms.reduce(
    (seatCount, room) =>
      seatCount + Math.max(room.maxPlayers - room.playersJoined, 0),
    0,
  );

  async function loadRooms() {
    try {
      const response = await fetch(`${apiBaseUrl}/rooms`);

      if (!response.ok) {
        throw new Error("Unable to load bingo rooms right now.");
      }

      const roomList = (await response.json()) as Room[];
      setRooms(roomList);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `${error.message} Start the backend or Docker stack and retry.`
          : "Unable to load bingo rooms right now.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadRooms();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${apiBaseUrl}/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formState),
      });

      if (!response.ok) {
        throw new Error("Room creation failed.");
      }

      const room = (await response.json()) as Room;
      setRooms((currentRooms) => [room, ...currentRooms]);
      setBoardPreview(buildBingoBoard());
      setFormState((currentState) => ({
        ...currentState,
        name: "",
      }));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Room creation failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const matchingRoom = rooms.find(
    (room) => room.roomCode === joinState.roomCode.trim().toUpperCase(),
  );

  return (
    <AppRoutes
      rooms={rooms}
      liveRooms={liveRooms}
      seatsOpen={seatsOpen}
      isLoading={isLoading}
      isSubmitting={isSubmitting}
      errorMessage={errorMessage}
      statusCopy={statusCopy}
      boardPreview={boardPreview}
      formState={formState}
      setFormState={setFormState}
      joinState={joinState}
      setJoinState={setJoinState}
      apiBaseUrl={apiBaseUrl}
      matchingRoom={matchingRoom}
      handleSubmit={handleSubmit}
    />
  );
}

export default App;
