"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { verifyPanelPasscode } from "@/lib/firebase";
import styles from "./panel-login.module.css";

export default function PanelLoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passcode.trim()) {
      setError("Please enter your panel passcode.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const panel = await verifyPanelPasscode(passcode.trim());
      if (!panel) {
        setError("Invalid passcode. Please check with the admin.");
        setLoading(false);
        return;
      }
      sessionStorage.setItem("oyster_panel", JSON.stringify({ id: panel.id, name: panel.name }));
      router.push("/panel");
    } catch (err) {
      console.error("Panel login error:", err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoMark}>
            <Image src="/logo1.svg" alt="Oyster Kode Club" width={48} height={48} />
          </div>
          <h1 className={styles.title}>Interview Panel Access</h1>
          <p className={styles.subtitle}>
            Enter your panel passcode to view assigned candidates.
          </p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="panel-passcode" className={styles.label}>
              Panel Passcode
            </label>
            <input
              id="panel-passcode"
              type="password"
              value={passcode}
              onChange={(e) => {
                setPasscode(e.target.value);
                setError("");
              }}
              placeholder="Enter passcode"
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
            id="panel-login-btn"
            disabled={loading || !passcode.trim()}
            className="btn btn-primary"
            style={{ width: "100%" }}
          >
            {loading ? "Verifying…" : "Enter Panel"}
          </button>
        </form>

        <p className={styles.footer}>
          This area is for authorized interviewers only.
          Contact the club admin if you need access.
        </p>
      </div>
    </main>
  );
}
