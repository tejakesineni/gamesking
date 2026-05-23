import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AdminView from "../pages/AdminView";
import GameShell from "../pages/GameShell";
import LandingPage from "../pages/LandingPage";
import type {
  BingoColumn,
  JoinGameFormState,
  NewGameFormState,
  Room,
  RoomStatus,
} from "../types/game";

type AppRoutesProps = {
  rooms: Room[];
  liveRooms: number;
  seatsOpen: number;
  isLoading: boolean;
  isSubmitting: boolean;
  errorMessage: string;
  statusCopy: Record<RoomStatus, string>;
  boardPreview: BingoColumn[];
  formState: NewGameFormState;
  setFormState: Dispatch<SetStateAction<NewGameFormState>>;
  joinState: JoinGameFormState;
  setJoinState: Dispatch<SetStateAction<JoinGameFormState>>;
  apiBaseUrl: string;
  matchingRoom?: Room;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export default function AppRoutes({
  rooms,
  liveRooms,
  seatsOpen,
  isLoading,
  isSubmitting,
  errorMessage,
  statusCopy,
  boardPreview,
  formState,
  setFormState,
  joinState,
  setJoinState,
  apiBaseUrl,
  matchingRoom,
  handleSubmit,
}: AppRoutesProps) {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/admin"
        element={
          <AdminView
            rooms={rooms}
            liveRooms={liveRooms}
            seatsOpen={seatsOpen}
            isLoading={isLoading}
            errorMessage={errorMessage}
            statusCopy={statusCopy}
            boardPreview={boardPreview}
          />
        }
      />
      <Route
        path="/new-game"
        element={
          <GameShell
            title="New game"
            description="Create a lobby, invite players, and use the generated code to join."
            actionLabel={
              isSubmitting ? "Opening lobby..." : "Create bingo room"
            }
            actionDisabled={isSubmitting}
            onAction={handleSubmit}
            boardPreview={boardPreview}
            rooms={rooms}
            isLoading={isLoading}
            errorMessage={errorMessage}
            currentMode="new"
            formState={formState}
            setFormState={setFormState}
            joinState={joinState}
            setJoinState={setJoinState}
            apiBaseUrl={apiBaseUrl}
            matchingRoom={matchingRoom}
          />
        }
      />
      <Route
        path="/join-game"
        element={
          <GameShell
            title="Join game"
            description="Enter a room code and player name to find an active bingo table."
            actionLabel={
              matchingRoom ? "Join selected room" : "Enter a valid room code"
            }
            actionDisabled={!matchingRoom || !joinState.playerName.trim()}
            onAction={(event) => event.preventDefault()}
            boardPreview={boardPreview}
            rooms={rooms}
            isLoading={isLoading}
            errorMessage={errorMessage}
            currentMode="join"
            formState={formState}
            setFormState={setFormState}
            joinState={joinState}
            setJoinState={setJoinState}
            apiBaseUrl={apiBaseUrl}
            matchingRoom={matchingRoom}
          />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
