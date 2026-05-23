import { useState } from "react";
import { Link } from "react-router-dom";
import gamesKingLogo from "../assets/games-king-logo.png";

export default function LandingPage() {
  const [logoMissing, setLogoMissing] = useState(false);

  return (
    <main className="app-shell landing-center-screen">
      <section className="hero-panel landing-center-panel">
        {!logoMissing ? (
          <img
            className="landing-brand-image"
            src={gamesKingLogo}
            alt="Games King"
            onError={() => setLogoMissing(true)}
          />
        ) : (
          <div className="landing-brand-fallback">Games King</div>
        )}

        <div className="hero-actions landing-actions">
          <Link className="hero-action is-active" to="/new-game">
            New game
          </Link>
          <Link className="hero-action" to="/join-game">
            Join game
          </Link>
        </div>
      </section>
    </main>
  );
}
