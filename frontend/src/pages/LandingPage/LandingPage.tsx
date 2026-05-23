import { useState } from "react";
import { Link } from "react-router-dom";
import gamesKingLogo from "../../assets/games-king-logo.png";
import styles from "./LandingPage.module.css";

export default function LandingPage() {
  const [logoMissing, setLogoMissing] = useState(false);

  return (
    <main className={styles.page}>
      <section className={styles.centerPanel}>
        {!logoMissing ? (
          <img
            className={styles.brandImage}
            src={gamesKingLogo}
            alt="Games King"
            onError={() => setLogoMissing(true)}
          />
        ) : (
          <div className={styles.brandFallback}>Games King</div>
        )}

        <div className={styles.actions}>
          <Link
            className={`${styles.actionBtn} ${styles.actionBtnActive}`}
            to="/new-game"
          >
            New game
          </Link>
          <Link className={styles.actionBtn} to="/join-game">
            Join game
          </Link>
        </div>
      </section>
    </main>
  );
}
