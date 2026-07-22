"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getPanels, createPanel, deletePanel, Panel } from "@/lib/firebase";
import AdminNav from "@/components/AdminNav";
import styles from "./panels.module.css";
import adminStyles from "../admin.module.css";

export default function PanelsPage() {
  const router = useRouter();
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("oyster_admin")) {
      router.replace("/admin/login");
    }
  }, [router]);

  const load = useCallback(() => {
    setLoading(true);
    getPanels()
      .then(setPanels)
      .catch(() => setError("Failed to load panels."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSignOut() {
    sessionStorage.removeItem("oyster_admin");
    router.push("/admin/login");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!newName.trim()) { setFormError("Panel name is required."); return; }
    if (!newPasscode.trim()) { setFormError("Passcode is required."); return; }
    if (newPasscode.length < 4) { setFormError("Passcode must be at least 4 characters."); return; }

    setSaving(true);
    try {
      const id = await createPanel(newName.trim(), newPasscode.trim());
      setPanels((prev) => [
        ...prev,
        {
          id,
          name: newName.trim(),
          passcode: newPasscode.trim(),
          createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as Panel["createdAt"],
        },
      ]);
      setNewName("");
      setNewPasscode("");
      setCreating(false);
    } catch {
      setFormError("Failed to create panel. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(panelId: string, panelName: string) {
    if (!window.confirm(`Delete panel "${panelName}"? This cannot be undone.`)) return;
    setDeletingId(panelId);
    try {
      await deletePanel(panelId);
      setPanels((prev) => prev.filter((p) => p.id !== panelId));
    } catch {
      setError("Failed to delete panel.");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function copyPanelLink(panelId: string) {
    const url = `${window.location.origin}/panel/login`;
    navigator.clipboard.writeText(url).catch(() => {});
  }

  if (loading) {
    return (
      <div className={adminStyles.loadingState}>
        <div className={adminStyles.spinner} />
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className={adminStyles.page}>
      <header className={adminStyles.topBar}>
        <div className={adminStyles.topBarInner}>
          <div className={adminStyles.topBarLeft}>
            <Image src="/logo1.svg" alt="Oyster Kode Club" width={32} height={32} />
            <div>
              <div className={adminStyles.breadcrumb}>Oyster Kode Club</div>
              <h1 className={adminStyles.pageTitle}>Interview Panels</h1>
            </div>
          </div>
          <button onClick={handleSignOut} className={`btn btn-outline ${adminStyles.signOutBtn}`}>
            Sign out
          </button>
        </div>
      </header>

      <AdminNav />

      <main className={adminStyles.main}>
        {error && <div className={adminStyles.errorBanner} role="alert">{error}</div>}

        <section className={adminStyles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={adminStyles.sectionTitle}>Panels</h2>
              <p className={styles.sectionDesc}>
                Create interview panels and share their passcodes with interviewers.
                Interviewers visit <strong>/panel/login</strong> to access their candidate list.
              </p>
            </div>
            {!creating && (
              <button
                id="create-panel-btn"
                onClick={() => setCreating(true)}
                className="btn btn-primary"
              >
                + New Panel
              </button>
            )}
          </div>

          {/* Create form */}
          {creating && (
            <form onSubmit={handleCreate} className={styles.createForm} noValidate>
              <h3 className={styles.createTitle}>New Interview Panel</h3>
              <div className={styles.formRow}>
                <div className={styles.field}>
                  <label htmlFor="panel-name" className={styles.label}>Panel Name</label>
                  <input
                    id="panel-name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Panel A, Technical Panel"
                    autoFocus
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="panel-passcode" className={styles.label}>Passcode</label>
                  <input
                    id="panel-passcode"
                    type="text"
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value)}
                    placeholder="Min. 4 characters"
                  />
                </div>
              </div>
              {formError && <p className={styles.formError} role="alert">{formError}</p>}
              <div className={styles.formActions}>
                <button
                  type="submit"
                  id="save-panel-btn"
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? "Creating…" : "Create Panel"}
                </button>
                <button
                  type="button"
                  onClick={() => { setCreating(false); setFormError(""); }}
                  className="btn btn-outline"
                  id="cancel-panel-btn"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Panel list */}
          {panels.length === 0 && !creating ? (
            <div className={styles.empty}>
              <p>No panels created yet.</p>
              <p className={styles.emptyHint}>Create a panel above, then assign candidates on the Interview page.</p>
            </div>
          ) : (
            <div className={styles.panelGrid}>
              {panels.map((panel) => (
                <div key={panel.id} className={styles.panelCard}>
                  <div className={styles.panelTop}>
                    <div className={styles.panelIcon}>🎤</div>
                    <div className={styles.panelInfo}>
                      <h3 className={styles.panelName}>{panel.name}</h3>
                      <div className={styles.passcodeRow}>
                        <span className={styles.passcodeLabel}>Passcode:</span>
                        <code className={styles.passcode}>
                          {revealedIds.has(panel.id)
                            ? panel.passcode
                            : "•".repeat(panel.passcode.length)}
                        </code>
                        <button
                          onClick={() => toggleReveal(panel.id)}
                          className={styles.revealBtn}
                          id={`reveal-${panel.id}`}
                          aria-label={revealedIds.has(panel.id) ? "Hide passcode" : "Show passcode"}
                        >
                          {revealedIds.has(panel.id) ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className={styles.panelActions}>
                    <button
                      onClick={() => copyPanelLink(panel.id)}
                      className={styles.copyBtn}
                      id={`copy-link-${panel.id}`}
                    >
                      Copy Panel Login URL
                    </button>
                    <button
                      onClick={() => handleDelete(panel.id, panel.name)}
                      disabled={deletingId === panel.id}
                      className={styles.deleteBtn}
                      id={`delete-panel-${panel.id}`}
                    >
                      {deletingId === panel.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Instructions */}
        <section className={adminStyles.section}>
          <h2 className={adminStyles.sectionTitle}>How It Works</h2>
          <div className={styles.howItWorks}>
            <div className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <div>
                <strong>Create panels</strong> above with a name and passcode.
              </div>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <div>
                Go to the <strong>Interview</strong> tab and assign each shortlisted candidate to a panel.
              </div>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <div>
                Share <strong>/panel/login</strong> and the panel passcode with each interviewer group.
              </div>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>4</span>
              <div>
                Interviewers see their candidates, read registration answers, and submit verdicts.
              </div>
            </div>
            <div className={styles.step}>
              <span className={styles.stepNum}>5</span>
              <div>
                Review panel verdicts on the Interview tab, then finalize on the <strong>Selected</strong> tab.
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
