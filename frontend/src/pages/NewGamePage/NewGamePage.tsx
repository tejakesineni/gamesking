import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import gamesKingLogo from "../../assets/games-king-logo.png";
import styles from "./NewGamePage.module.css";
import type { GameOption, NewGameFormState } from "../../types/game";
import { createRoom } from "./NewGamePage.service";

const gameOptions: GameOption[] = [
  "Bingo",
  "Ludo",
  "Snakes and Ladders",
  "Tambola",
  "Tic Tac Toe",
];

export default function NewGamePage() {
  const navigate = useNavigate();
  const [logoMissing, setLogoMissing] = useState(false);
  const [formState, setFormState] = useState<NewGameFormState>({
    hostName: "",
  });
  const [selectedGame, setSelectedGame] = useState<GameOption | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function onCreateRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const room = await createRoom({
        hostName: formState.hostName,
        game: selectedGame,
      });

      navigate(
        `/waiting-room/${encodeURIComponent(room.roomCode)}?hostName=${encodeURIComponent(
          formState.hostName.trim(),
        )}`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Room creation failed.",
      );
    } finally {
      setIsSubmitting(false);
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
              alt="Games King – back to home"
              onError={() => setLogoMissing(true)}
            />
          ) : (
            <div className={styles.logoFallback}>Games King</div>
          )}
        </Link>
      </div>

      <section className={styles.section}>
        <form className={styles.form} onSubmit={onCreateRoom}>
          <div className={styles.panelHeader}>
            <span>Create room</span>
            <p>Fill in your name and choose a game to continue.</p>
          </div>

          <label>
            <span>Name</span>
            <input
              required
              value={formState.hostName}
              onChange={(event) =>
                setFormState((currentState) => ({
                  ...currentState,
                  hostName: event.target.value,
                }))
              }
              placeholder="Priya"
            />
          </label>

          <label>
            <span>Select game</span>
            <select
              required
              value={selectedGame}
              onChange={(event) =>
                setSelectedGame(event.target.value as GameOption)
              }
            >
              <option value="">Choose a game</option>
              {gameOptions.map((gameOption) => (
                <option key={gameOption} value={gameOption}>
                  {gameOption}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={
              isSubmitting || !formState.hostName.trim() || !selectedGame
            }
          >
            {isSubmitting ? "Creating room..." : "Create room"}
          </button>

          {errorMessage ? (
            <div className={styles.errorBanner}>{errorMessage}</div>
          ) : null}
        </form>
      </section>
    </main>
  );
}
