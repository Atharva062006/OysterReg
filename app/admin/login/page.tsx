"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
          <div className={styles.logoMark}>
            <Image src="/logo1.svg" alt="Oyster Kode Club" width={52} height={52} />
          </div>
          <h1 className={styles.title}>Admin Access</h1>
          <p className={styles.subtitle}>Oyster Kode Club — Recruitment 2026</p>
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
          This area is restricted to Oyster Kode Club administrators only.
        </p>
      </div>
    </main>
  );
}

