"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { verifyPanelPasscode, Panel } from "@/lib/firebase";
import styles from "./panel-login.module.css";

export default function PanelLoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Verification step
  const [verifiedPanel, setVerifiedPanel] = useState<Panel | null>(null);
  const [selectedMember, setSelectedMember] = useState("");
  const [customMemberName, setCustomMemberName] = useState("");

  async function handleVerifyPasscode(e: React.FormEvent) {
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
      setVerifiedPanel(panel);
      if (panel.members && panel.members.length > 0) {
        setSelectedMember(panel.members[0]);
      }
    } catch (err) {
      console.error("Panel login error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleCompleteLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!verifiedPanel) return;

    const finalMemberName = selectedMember === "__custom__" ? customMemberName.trim() : (selectedMember || customMemberName.trim() || "Interviewer");
    if (!finalMemberName) {
      setError("Please select or enter your name.");
      return;
    }

    sessionStorage.setItem(
      "oyster_panel",
      JSON.stringify({
        id: verifiedPanel.id,
        name: verifiedPanel.name,
        memberName: finalMemberName,
        eventId: verifiedPanel.eventId || "recruitment-2026",
      })
    );
    router.push("/panel");
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
            {verifiedPanel ? `Logged in to ${verifiedPanel.name}` : "Enter your panel passcode to access member scoring."}
          </p>
        </div>

        {!verifiedPanel ? (
          /* Step 1: Verify Passcode */
          <form onSubmit={handleVerifyPasscode} className={styles.form} noValidate>
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
              {loading ? "Verifying…" : "Continue →"}
            </button>
          </form>
        ) : (
          /* Step 2: Select Panel Member Name */
          <form onSubmit={handleCompleteLogin} className={styles.form} noValidate>
            <div className={styles.field}>
              <label className={styles.label}>Select Your Interviewer Name</label>
              {verifiedPanel.members && verifiedPanel.members.length > 0 ? (
                <select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-primary)",
                    fontSize: "0.9375rem",
                  }}
                >
                  {verifiedPanel.members.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter Different Name</option>
                </select>
              ) : null}

              {(selectedMember === "__custom__" || !verifiedPanel.members || verifiedPanel.members.length === 0) && (
                <input
                  type="text"
                  value={customMemberName}
                  onChange={(e) => setCustomMemberName(e.target.value)}
                  placeholder="Enter your name (e.g. Atharva)"
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    marginTop: "0.5rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-primary)",
                    fontSize: "0.9375rem",
                  }}
                />
              )}

              {error && (
                <p className={styles.errorMsg} role="alert" style={{ marginTop: "0.5rem" }}>
                  {error}
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button
                type="button"
                onClick={() => setVerifiedPanel(null)}
                className="btn btn-outline"
                style={{ width: "35%" }}
              >
                Back
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "65%" }}
              >
                Enter Workspace →
              </button>
            </div>
          </form>
        )}

        <p className={styles.footer}>
          This area is for authorized interviewers only. Contact the club admin if you need access.
        </p>
      </div>
    </main>
  );
}
