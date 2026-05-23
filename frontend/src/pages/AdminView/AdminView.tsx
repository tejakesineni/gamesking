import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { BingoColumn, Room, RoomStatus } from "../../types/game";
import { fetchAdminRooms } from "./AdminView.service";
import { buildBingoBoard } from "../../utils/bingoBoard";

const statusCopy: Record<RoomStatus, string> = {
  waiting: "Lobby open",
  live: "Numbers rolling",
  finished: "Round closed",
};

export default function AdminView() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [boardPreview] = useState<BingoColumn[]>(() => buildBingoBoard());

  const liveRooms = rooms.filter((room) => room.status === "live").length;

  useEffect(() => {
    void (async () => {
      try {
        const roomList = await fetchAdminRooms();
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
    })();
  }, []);

  return (
    <main className="app-shell">
      <section className="hero-panel compact-hero">
        <div className="brand-row">
          <div className="brand-logo" aria-hidden="true">
            <span>G</span>
            <span>K</span>
          </div>
          <div>
            <div className="eyebrow">Games King Admin</div>
            <p className="brand-subtitle">Room control and game monitoring</p>
          </div>
        </div>

        <h1>Admin dashboard</h1>
        <p className="hero-copy">
          Monitor active rooms, inspect the current board preview, and manage
          the live game surface from a separate admin route.
        </p>

        <div className="hero-actions">
          <Link className="hero-action" to="/">
            Landing page
          </Link>
          <Link className="hero-action" to="/new-game">
            New game
          </Link>
          <Link className="hero-action" to="/join-game">
            Join game
          </Link>
        </div>

        <div className="stat-row">
          <article>
            <strong>{rooms.length}</strong>
            <span>Total rooms</span>
          </article>
          <article>
            <strong>{liveRooms}</strong>
            <span>Live games</span>
          </article>
          <article>
            <strong>{rooms.length - liveRooms}</strong>
            <span>Waiting rooms</span>
          </article>
        </div>
      </section>

      <section className="grid-layout">
        <aside className="board-panel">
          <div className="panel-header">
            <span>Card preview</span>
            <p>
              This is the admin-facing layout for monitoring player cards and
              bingo state.
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
        </aside>

        <section className="rooms-panel">
          <div className="panel-header">
            <span>Room directory</span>
            <p>
              Backend data comes from Postgres through the NestJS room
              endpoints.
            </p>
          </div>

          <div className="room-list">
            {isLoading ? <p className="empty-state">Loading rooms...</p> : null}

            {!isLoading && rooms.length === 0 ? (
              <p className="empty-state">
                No rooms yet. Create the first one from New game.
              </p>
            ) : null}

            {rooms.map((room) => (
              <article key={room.roomCode} className="room-card">
                <div>
                  <div className="room-card-top">
                    <h2>{room.game}</h2>
                    <span className={`status-pill status-${room.status}`}>
                      {statusCopy[room.status]}
                    </span>
                  </div>
                  <p>
                    Hosted by {room.hostName} · Code {room.roomCode}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
