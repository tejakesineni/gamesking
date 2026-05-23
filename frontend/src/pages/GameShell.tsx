import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Link } from "react-router-dom";
import type {
  BingoColumn,
  JoinGameFormState,
  NewGameFormState,
  Room,
} from "../types/game";

type GameShellProps = {
  title: string;
  description: string;
  actionLabel: string;
  actionDisabled: boolean;
  onAction: (event: FormEvent<HTMLFormElement>) => void;
  boardPreview: BingoColumn[];
  rooms: Room[];
  isLoading: boolean;
  errorMessage: string;
  currentMode: "new" | "join";
  formState: NewGameFormState;
  setFormState: Dispatch<SetStateAction<NewGameFormState>>;
  joinState: JoinGameFormState;
  setJoinState: Dispatch<SetStateAction<JoinGameFormState>>;
  apiBaseUrl: string;
  matchingRoom?: Room;
};

export default function GameShell({
  title,
  description,
  actionLabel,
  actionDisabled,
  onAction,
  boardPreview,
  rooms,
  isLoading,
  errorMessage,
  currentMode,
  formState,
  setFormState,
  joinState,
  setJoinState,
  apiBaseUrl,
  matchingRoom,
}: GameShellProps) {
  return (
    <main className="app-shell">
      <section className="hero-panel compact-hero">
        <div className="brand-row">
          <div className="brand-logo" aria-hidden="true">
            <span>G</span>
            <span>K</span>
          </div>
          <div>
            <div className="eyebrow">Games King</div>
            <p className="brand-subtitle">Classic board and casual games</p>
          </div>
        </div>

        <h1>{title}</h1>
        <p className="hero-copy">{description}</p>

        <div className="hero-actions">
          <Link
            className={
              currentMode === "new" ? "hero-action is-active" : "hero-action"
            }
            to="/new-game"
          >
            New game
          </Link>
          <Link
            className={
              currentMode === "join" ? "hero-action is-active" : "hero-action"
            }
            to="/join-game"
          >
            Join game
          </Link>
        </div>

        <div className="topbar-link-row">
          <Link to="/" className="text-link">
            Back to landing page
          </Link>
        </div>
      </section>

      <section className="grid-layout">
        <form className="control-panel" onSubmit={onAction}>
          {currentMode === "new" ? (
            <>
              <div className="panel-header">
                <span>New game</span>
                <p>
                  Create a lobby, invite players, and use the generated code to
                  join.
                </p>
              </div>

              <label>
                <span>Room name</span>
                <input
                  required
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Neighborhood Jackpot"
                />
              </label>

              <label>
                <span>Host name</span>
                <input
                  required
                  value={formState.hostName}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      hostName: event.target.value,
                    }))
                  }
                  placeholder="Ari"
                />
              </label>

              <label>
                <span>Max players</span>
                <input
                  required
                  type="number"
                  min="2"
                  max="20"
                  value={formState.maxPlayers}
                  onChange={(event) =>
                    setFormState((currentState) => ({
                      ...currentState,
                      maxPlayers: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </>
          ) : (
            <>
              <div className="panel-header">
                <span>Join game</span>
                <p>
                  Enter a room code and player name to find an active bingo
                  table.
                </p>
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
                  placeholder="KWNGU4"
                />
              </label>

              <label>
                <span>Player name</span>
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

              {joinState.roomCode ? (
                <div className="stack-note">
                  <strong>
                    {matchingRoom ? "Room found" : "No room found yet"}
                  </strong>
                  <span>
                    {matchingRoom
                      ? `${matchingRoom.name} hosted by ${matchingRoom.hostName}`
                      : "Try one of the codes listed in the room directory below."}
                  </span>
                </div>
              ) : null}
            </>
          )}

          <button type="submit" disabled={actionDisabled}>
            {actionLabel}
          </button>

          <div className="stack-note">
            <strong>Current API target</strong>
            <span>{apiBaseUrl}</span>
          </div>
        </form>

        <aside className="board-panel">
          <div className="panel-header">
            <span>Card preview</span>
            <p>
              Use this as the basis for player cards, daubed states, and win
              checks.
            </p>
          </div>

          <div className="board-grid" aria-label="Bingo board preview">
            {boardPreview.map((column) => (
              <div key={column.label} className="board-column">
                <div className="board-label">{column.label}</div>
                {column.values.map((value, valueIndex) => (
                  <div
                    key={`${column.label}-${valueIndex}-${String(value)}`}
                    className={
                      value === "FREE"
                        ? "board-cell board-cell-free"
                        : "board-cell"
                    }
                  >
                    {value}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {errorMessage ? (
            <div className="message-banner">{errorMessage}</div>
          ) : null}

          <div className="room-list">
            {isLoading ? <p className="empty-state">Loading rooms...</p> : null}
            {rooms.slice(0, 3).map((room) => (
              <article key={room.id} className="room-card">
                <div>
                  <div className="room-card-top">
                    <h2>{room.name}</h2>
                    <span className={`status-pill status-${room.status}`}>
                      {room.status}
                    </span>
                  </div>
                  <p>
                    Hosted by {room.hostName} · Code {room.roomCode}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
