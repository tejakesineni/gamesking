import { Link } from "react-router-dom";
import type { BingoColumn, Room, RoomStatus } from "../types/game";

type AdminViewProps = {
  rooms: Room[];
  liveRooms: number;
  seatsOpen: number;
  isLoading: boolean;
  errorMessage: string;
  statusCopy: Record<RoomStatus, string>;
  boardPreview: BingoColumn[];
};

export default function AdminView({
  rooms,
  liveRooms,
  seatsOpen,
  isLoading,
  errorMessage,
  statusCopy,
  boardPreview,
}: AdminViewProps) {
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
            <strong>{seatsOpen}</strong>
            <span>Open seats</span>
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
              <article key={room.id} className="room-card">
                <div>
                  <div className="room-card-top">
                    <h2>{room.name}</h2>
                    <span className={`status-pill status-${room.status}`}>
                      {statusCopy[room.status]}
                    </span>
                  </div>
                  <p>
                    Hosted by {room.hostName} · Code {room.roomCode}
                  </p>
                </div>

                <div className="room-card-bottom">
                  <strong>
                    {room.playersJoined}/{room.maxPlayers}
                  </strong>
                  <span>players in the room</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
