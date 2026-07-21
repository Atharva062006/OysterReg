"use client";

import Link from "next/link";
import Image from "next/image";
import styles from "./home.module.css";

export default function HomePage() {
  return (
    <main className={styles.main}>
      {/* Radial glow behind text */}
      <div className={styles.glowOverlay} aria-hidden="true" />

      {/* Logo + club name */}
      <div className={styles.logoRow}>
        <Image
          src="/logo4.png"
          alt="Oyster Kode Club logo"
          width={52}
          height={52}
          priority
          className={styles.logo}
        />
        <span className={styles.clubLabel}>Oyster Kode Club</span>
      </div>

      {/* Headline */}
      <h1 className={styles.headline}>
        Build.<br />
        <span className={styles.headlineGradient}>Collaborate.</span><br />
        Innovate.
      </h1>

      <p className={styles.tagline}>
        Recruitment 2026 — Applications are now open.
      </p>

      {/* CTA Buttons */}
      <div className={styles.actions}>
        <Link
          href="/register"
          id="cta-register"
          className={`${styles.btn} ${styles.btnPrimary}`}
        >
          Register
        </Link>
        <Link
          href="/why-join-us"
          id="cta-why-join"
          className={`${styles.btn} ${styles.btnOutline}`}
        >
          Why Join Us
        </Link>
      </div>
    </main>
  );
}
