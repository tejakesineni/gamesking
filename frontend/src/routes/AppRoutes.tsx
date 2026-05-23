import { Navigate, Route, Routes } from "react-router-dom";
import AdminView from "../pages/AdminView/AdminView";
import JoinGamePage from "../pages/JoinGamePage/JoinGamePage";
import LandingPage from "../pages/LandingPage/LandingPage";
import NewGamePage from "../pages/NewGamePage/NewGamePage";
import WaitingRoomPage from "../pages/WaitingRoomPage/WaitingRoomPage";
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin" element={<AdminView />} />
      <Route path="/new-game" element={<NewGamePage />} />
      <Route path="/join-game" element={<JoinGamePage />} />
      <Route path="/join-game/:roomCode" element={<JoinGamePage />} />
      <Route path="/waiting-room/:roomCode" element={<WaitingRoomPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
