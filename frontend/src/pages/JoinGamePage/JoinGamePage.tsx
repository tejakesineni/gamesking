import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import gamesKingLogo from "../../assets/games-king-logo.png";
import type { JoinGameFormState } from "../../types/game";
import { joinRoom } from "./JoinGamePage.service";
import styles from "./JoinGamePage.module.css";

export default function JoinGamePage() {
  const navigate = useNavigate();
  const { roomCode: routeRoomCode } = useParams<{ roomCode: string }>();
  const [logoMissing, setLogoMissing] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [joinState, setJoinState] = useState<JoinGameFormState>({
    roomCode: routeRoomCode ?? "",
    playerName: "",
  });

  const actionDisabled =
    isJoining || !joinState.roomCode.trim() || !joinState.playerName.trim();

  async function onAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setJoinMessage("");
    setErrorMessage("");

    if (!joinState.roomCode.trim() || !joinState.playerName.trim()) {
      return;
    }

    setIsJoining(true);

    try {
      const joinedUser = await joinRoom({
        roomCode: joinState.roomCode.trim().toUpperCase(),
        playerName: joinState.playerName.trim(),
      });

      navigate(
        `/game/${encodeURIComponent(joinedUser.roomCode)}?playerName=${encodeURIComponent(joinedUser.playerName)}`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to join this room.",
      );
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.logoCorner}>
        <Link to="/">
          {!logoMissing ? (
            <img
              className={styles.logoImage}
              src={gamesKingLogo}
              alt="Games King - back to home"
              onError={() => setLogoMissing(true)}
            />
          ) : (
            <div className={styles.logoFallback}>Games King</div>
          )}
        </Link>
      </div>

      <section className={styles.section}>
        <form className={styles.form} onSubmit={onAction}>
          <div className={styles.panelHeader}>
            <span>Join room</span>
            <p>Enter room ID and your name to join.</p>
          </div>

          <label>
            <span>Room code</span>
            <input
              required
              value={joinState.roomCode}
              onChange={(event) =>
                setJoinState((currentState) => ({
                  ...currentState,
                  roomCode: event.target.value.toUpperCase(),
                }))
              }
              placeholder="B2QTC8"
            />
          </label>

          <label>
            <span>Name</span>
            <input
              required
              value={joinState.playerName}
              onChange={(event) =>
                setJoinState((currentState) => ({
                  ...currentState,
                  playerName: event.target.value,
                }))
              }
              placeholder="Maya"
            />
          </label>

          <button type="submit" disabled={actionDisabled}>
            {isJoining ? "Joining..." : "Join"}
          </button>

          {errorMessage ? (
            <div className={styles.errorBanner}>{errorMessage}</div>
          ) : null}

          {joinMessage ? (
            <div className={styles.errorBanner}>{joinMessage}</div>
          ) : null}
        </form>
      </section>
    </main>
  );
}
