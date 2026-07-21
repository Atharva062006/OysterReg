"use client";

import Link from "next/link";
import Image from "next/image";
import styles from "./why-join-us.module.css";

const REASONS = [
  {
    icon: "💻",
    title: "Build Real Projects",
    description:
      "Work on production-grade apps and open-source tools that solve real problems — not just academic exercises.",
  },
  {
    icon: "🤝",
    title: "Collaborate & Grow",
    description:
      "Pair-program with talented peers, get code reviews, and level up your skills through hands-on collaboration.",
  },
  {
    icon: "🏆",
    title: "Win Hackathons",
    description:
      "We compete in national and international hackathons. Oyster members have consistently ranked on podiums.",
  },
  {
    icon: "🚀",
    title: "Mentorship Network",
    description:
      "Get guidance from alumni who are now at top companies and startups — your network starts here.",
  },
  {
    icon: "📚",
    title: "Workshops & Talks",
    description:
      "Regular sessions on web dev, AI/ML, open source, DevOps, and more — always free, always hands-on.",
  },
  {
    icon: "🌐",
    title: "Shape the Tech Community",
    description:
      "Organise events, lead initiatives, and make your mark on the college's tech culture.",
  },
];

export default function WhyJoinUsPage() {
  return (
    <main className={styles.main}>
      <div className={styles.glowOverlay} aria-hidden="true" />

      <div className={styles.inner}>
        {/* Back link */}
        <Link href="/" className={styles.backLink} id="back-home">
          ← Back to home
        </Link>

        {/* Header */}
        <header className={styles.header}>
          <div className={styles.logoRow}>
            <Image src="/logo4.png" alt="Oyster Kode Club" width={40} height={40} />
            <span className={styles.clubLabel}>Oyster Kode Club</span>
          </div>
          <h1 className={styles.headline}>
            Why join{" "}
            <span className={styles.headlineGradient}>Oyster?</span>
          </h1>
          <p className={styles.subtitle}>
            We are more than a coding club — we are a launchpad for the next generation of builders.
          </p>
        </header>

        {/* Reasons grid */}
        <section className={styles.grid} aria-label="Reasons to join">
          {REASONS.map((r) => (
            <div key={r.title} className={styles.card}>
              <span className={styles.cardIcon} aria-hidden="true">
                {r.icon}
              </span>
              <h2 className={styles.cardTitle}>{r.title}</h2>
              <p className={styles.cardDesc}>{r.description}</p>
            </div>
          ))}
        </section>

        {/* CTA */}
        <div className={styles.cta}>
          <p className={styles.ctaText}>Ready to be part of something great?</p>
          <Link href="/register" id="wju-register-cta" className={styles.ctaBtn}>
            Apply Now →
          </Link>
        </div>
      </div>
    </main>
  );
}
