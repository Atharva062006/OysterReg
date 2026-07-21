"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Small delay to feel less instant (avoids brute-force UX)
    await new Promise((r) => setTimeout(r, 400));

    const correct = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    if (password === correct) {
      sessionStorage.setItem("oyster_admin", "1");
      router.push("/admin");
    } else {
      setError("Incorrect password. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.lockIcon} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className={styles.title}>Admin Access</h1>
          <p className={styles.subtitle}>Oyster Coding Club — Recruitment 2025</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="admin-password" className={styles.label}>
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="Enter admin password"
              autoComplete="current-password"
              autoFocus
              className={error ? styles.inputError : ""}
            />
            {error && (
              <p className={styles.errorMsg} role="alert">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            id="admin-login-btn"
            disabled={loading || !password}
            className={`btn btn-primary ${styles.submitBtn}`}
          >
            {loading ? "Verifying..." : "Sign In"}
          </button>
        </form>

        <p className={styles.footer}>
          This area is restricted to club administrators only.
        </p>
      </div>
    </main>
  );
}
