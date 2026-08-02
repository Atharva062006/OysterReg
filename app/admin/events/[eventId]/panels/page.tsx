"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getEventById,
  getPanels,
  createPanel,
  updatePanel,
  deletePanel,
  Event,
  Panel,
} from "@/lib/firebase";
import EventAdminNav from "@/components/EventAdminNav";
import styles from "@/app/admin/admin.module.css";
import panelStyles from "@/app/admin/panels/panels.module.css";

interface EventPanelsPageProps {
  params: Promise<{ eventId: string }>;
}

export default function EventPanelsPage({ params }: EventPanelsPageProps) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.eventId;

  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [newMembersStr, setNewMembersStr] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit Panel state
  const [editingPanel, setEditingPanel] = useState<Panel | null>(null);
  const [editMembersStr, setEditMembersStr] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auth gate
  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem("oyster_admin")) {
      router.replace("/admin/login");
    }
  }, [router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const ev = await getEventById(eventId);
      if (!ev) {
        setError("Event not found.");
        return;
      }
      setEvent(ev);
      const list = await getPanels(eventId);
      setPanels(list);
    } catch (err) {
      console.error(err);
      setError("Failed to load panel details.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

    const members = newMembersStr.split(",").map((m) => m.trim()).filter(Boolean);

    setSaving(true);
    try {
      const id = await createPanel(newName.trim(), newPasscode.trim(), eventId, members);
      setPanels((prev) => [
        ...prev,
        {
          id,
          name: newName.trim(),
          passcode: newPasscode.trim(),
          members,
          createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as Panel["createdAt"],
          eventId,
        },
      ]);
      setNewName("");
      setNewPasscode("");
      setNewMembersStr("");
      setCreating(false);
    } catch {
      setFormError("Failed to create panel. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMembers(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPanel) return;
    const members = editMembersStr.split(",").map((m) => m.trim()).filter(Boolean);
    try {
      await updatePanel(editingPanel.id, { members });
      setPanels((prev) =>
        prev.map((p) => (p.id === editingPanel.id ? { ...p, members } : p))
      );
      setEditingPanel(null);
    } catch {
      alert("Failed to update panel members.");
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
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(panelId);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Loading event panels…</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <div className={styles.errorBanner}>{error || "Event not found."}</div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Top Bar */}
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <div className={styles.topBarLeft}>
            <Image src="/logo1.svg" alt="Oyster Kode Club" width={32} height={32} />
            <div>
              <div className={styles.breadcrumb}>{event.name}</div>
              <h1 className={styles.pageTitle}>Interview Panels Setup</h1>
            </div>
          </div>
          <button onClick={handleSignOut} className={`btn btn-outline ${styles.signOutBtn}`}>
            Sign out
          </button>
        </div>
      </header>

      {/* Nav */}
      <EventAdminNav eventId={eventId} eventName={event.name} eventType={event.type} />

      <main className={styles.main}>
        {error && <div className={styles.errorBanner}>{error}</div>}

        <section className={styles.section}>
          <div className={panelStyles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Panels & Interviewer Members</h2>
              <p className={panelStyles.sectionDesc}>
                Define interview panels, assign interviewer panel members, and set passcodes. Interviewers visit <strong>/panel/login</strong> to select their name and evaluate candidates.
              </p>
            </div>
            {!creating && (
              <button
                onClick={() => setCreating(true)}
                className="btn btn-primary"
                id="create-panel-btn"
              >
                + New Panel
              </button>
            )}
          </div>

          {/* Create Form */}
          {creating && (
            <form onSubmit={handleCreate} className={panelStyles.createForm} noValidate>
              <h3 className={panelStyles.createTitle}>New Interview Panel</h3>
              <div className={panelStyles.formRow}>
                <div className={panelStyles.field}>
                  <label className={panelStyles.label}>Panel Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Panel A, Technical Panel"
                    autoFocus
                  />
                </div>
                <div className={panelStyles.field}>
                  <label className={panelStyles.label}>Passcode</label>
                  <input
                    type="text"
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value)}
                    placeholder="Min. 4 characters"
                  />
                </div>
              </div>
              <div className={panelStyles.field} style={{ marginTop: "1rem" }}>
                <label className={panelStyles.label}>Panel Members (comma-separated)</label>
                <input
                  type="text"
                  value={newMembersStr}
                  onChange={(e) => setNewMembersStr(e.target.value)}
                  placeholder="e.g. Atharva, John, Sarah"
                />
              </div>
              {formError && <p className={panelStyles.formError} role="alert">{formError}</p>}
              <div className={panelStyles.formActions}>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? "Creating…" : "Create Panel"}
                </button>
                <button type="button" onClick={() => { setCreating(false); setFormError(""); }} className="btn btn-outline">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Panel Grid */}
          {panels.length === 0 && !creating ? (
            <div className={panelStyles.empty}>
              <p>No interview panels created for this event yet.</p>
              <p className={panelStyles.emptyHint}>Create a panel above, then assign candidates on the Interview & Panels page.</p>
            </div>
          ) : (
            <div className={panelStyles.panelGrid}>
              {panels.map((panel) => (
                <div key={panel.id} className={panelStyles.panelCard}>
                  <div className={panelStyles.panelTop}>
                    <div className={panelStyles.panelInfo}>
                      <h3 className={panelStyles.panelName}>{panel.name}</h3>
                      <div className={panelStyles.passcodeRow}>
                        <span className={panelStyles.passcodeLabel}>Passcode:</span>
                        <code className={panelStyles.passcode}>
                          {revealedIds.has(panel.id)
                            ? panel.passcode
                            : "•".repeat(panel.passcode.length)}
                        </code>
                        <button
                          onClick={() => toggleReveal(panel.id)}
                          className={panelStyles.revealBtn}
                          id={`reveal-${panel.id}`}
                        >
                          {revealedIds.has(panel.id) ? "Hide" : "Show"}
                        </button>
                      </div>

                      {/* Members List */}
                      <div style={{ marginTop: "0.75rem" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                          Panel Members:
                        </div>
                        {panel.members && panel.members.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                            {panel.members.map((m) => (
                              <span
                                key={m}
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  padding: "0.15rem 0.5rem",
                                  borderRadius: "var(--radius-sm)",
                                  background: "rgba(245, 166, 35, 0.15)",
                                  color: "var(--accent)",
                                  border: "1px solid rgba(245, 166, 35, 0.3)",
                                }}
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>No member names added yet</span>
                        )}
                        <button
                          onClick={() => {
                            setEditingPanel(panel);
                            setEditMembersStr((panel.members || []).join(", "));
                          }}
                          className="btn btn-sm btn-outline"
                          style={{ fontSize: "0.7rem", marginTop: "0.5rem", padding: "0.15rem 0.4rem" }}
                        >
                          Edit Members
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className={panelStyles.panelActions}>
                    <button
                      onClick={() => copyPanelLink(panel.id)}
                      className={panelStyles.copyBtn}
                      id={`copy-link-${panel.id}`}
                    >
                      {copiedId === panel.id ? "✓ URL Copied!" : "Copy Panel Login URL"}
                    </button>
                    <button
                      onClick={() => handleDelete(panel.id, panel.name)}
                      disabled={deletingId === panel.id}
                      className={panelStyles.deleteBtn}
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
      </main>

      {/* Edit Members Modal */}
      {editingPanel && (
        <div className={styles.modalOverlay} onClick={() => setEditingPanel(null)}>
          <div className={styles.modalContent} style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Edit Panel Members — {editingPanel.name}</h3>
              <button onClick={() => setEditingPanel(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.25rem", cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={handleSaveMembers} style={{ marginTop: "1rem" }}>
              <div className={panelStyles.field}>
                <label className={panelStyles.label}>Interviewer Names (comma-separated)</label>
                <input
                  type="text"
                  value={editMembersStr}
                  onChange={(e) => setEditMembersStr(e.target.value)}
                  placeholder="e.g. Atharva, John, Sarah"
                  autoFocus
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
                <button type="button" onClick={() => setEditingPanel(null)} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Members</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
