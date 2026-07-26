"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getEventById,
  saveEventStages,
  Event,
  EventStage,
} from "@/lib/firebase";
import EventAdminNav from "@/components/EventAdminNav";
import styles from "@/app/admin/admin.module.css";

interface StageBuilderPageProps {
  params: Promise<{ eventId: string }>;
}

const COLOR_OPTIONS: { value: EventStage["color"]; label: string }[] = [
  { value: "default", label: "Default (Gray)" },
  { value: "blue", label: "Blue" },
  { value: "amber", label: "Amber / Yellow" },
  { value: "green", label: "Green" },
  { value: "purple", label: "Purple" },
  { value: "rose", label: "Rose / Red" },
  { value: "indigo", label: "Indigo" },
];

export default function StageBuilderPage({ params }: StageBuilderPageProps) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.eventId;

  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [stages, setStages] = useState<EventStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // New stage form state
  const [newStageName, setNewStageName] = useState("");
  const [newStageColor, setNewStageColor] = useState<EventStage["color"]>("blue");

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
      setStages(ev.stages || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load stage configuration.");
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

  function handleAddStage(e: React.FormEvent) {
    e.preventDefault();
    if (!newStageName.trim()) return;

    const id = newStageName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (stages.some((s) => s.id === id)) {
      alert("A stage with a similar name already exists.");
      return;
    }

    const newStage: EventStage = {
      id,
      name: newStageName.trim(),
      color: newStageColor,
      order: stages.length + 1,
    };

    setStages((prev) => [...prev, newStage]);
    setNewStageName("");
    setNewStageColor("blue");
  }

  function handleRemoveStage(id: string) {
    if (stages.length <= 1) {
      alert("An event must have at least 1 pipeline stage.");
      return;
    }
    setStages((prev) => prev.filter((s) => s.id !== id));
  }

  function handleMove(index: number, direction: "up" | "down") {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === stages.length - 1)
    ) {
      return;
    }

    const next = [...stages];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;

    // re-index order
    const updated = next.map((st, i) => ({ ...st, order: i + 1 }));
    setStages(updated);
  }

  function handleUpdateName(id: string, name: string) {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name } : s))
    );
  }

  function handleUpdateColor(id: string, color: EventStage["color"]) {
    setStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, color } : s))
    );
  }

  async function handleSave() {
    setSaving(true);
    setSuccess("");
    setError("");
    try {
      await saveEventStages(eventId, stages);
      setSuccess("Pipeline stages saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save stages.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Loading stage pipeline builder…</p>
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
              <h1 className={styles.pageTitle}>Dynamic Stage Pipeline Builder</h1>
            </div>
          </div>
          <button onClick={handleSignOut} className={`btn btn-outline ${styles.signOutBtn}`}>
            Sign out
          </button>
        </div>
      </header>

      {/* Nav */}
      <EventAdminNav eventId={eventId} eventName={event.name} />

      <main className={styles.main}>
        {error && <div className={styles.errorBanner}>{error}</div>}
        {success && (
          <div
            style={{
              background: "rgba(34, 197, 94, 0.15)",
              border: "1px solid #22c55e",
              color: "#22c55e",
              padding: "0.875rem 1rem",
              borderRadius: "var(--radius-md)",
            }}
          >
            {success}
          </div>
        )}

        <section className={styles.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h2 className={styles.sectionTitle}>Pipeline Stages Configuration</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                Add, remove, re-order, and customize evaluation stages for candidates in <strong>{event.name}</strong>.
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
              id="save-stages-btn"
            >
              {saving ? "Saving Changes..." : "Save Stage Pipeline"}
            </button>
          </div>

          {/* List of current stages */}
          <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            {stages.map((st, index) => (
              <div
                key={st.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "1rem 1.25rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "1rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: "260px" }}>
                  <div
                    style={{
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      width: "28px",
                      textAlign: "center",
                    }}
                  >
                    #{index + 1}
                  </div>
                  <input
                    type="text"
                    value={st.name}
                    onChange={(e) => handleUpdateName(st.id, e.target.value)}
                    style={{
                      flex: 1,
                      padding: "0.5rem 0.75rem",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--text-primary)",
                      fontWeight: 600,
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {/* Color selector */}
                  <select
                    value={st.color || "default"}
                    onChange={(e) => handleUpdateColor(st.id, e.target.value as any)}
                    style={{
                      padding: "0.5rem 0.75rem",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--text-primary)",
                      fontSize: "0.8125rem",
                    }}
                  >
                    {COLOR_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>

                  {/* Reorder Buttons */}
                  <button
                    onClick={() => handleMove(index, "up")}
                    disabled={index === 0}
                    className="btn btn-sm btn-outline"
                    title="Move Stage Up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMove(index, "down")}
                    disabled={index === stages.length - 1}
                    className="btn btn-sm btn-outline"
                    title="Move Stage Down"
                  >
                    ↓
                  </button>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveStage(st.id)}
                    className="btn btn-sm btn-outline"
                    style={{ color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                    title="Remove Stage"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add New Stage Form */}
          <form
            onSubmit={handleAddStage}
            style={{
              marginTop: "2rem",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1.5px dashed var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.25rem 1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: 1, minWidth: "220px" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                New Stage Name
              </label>
              <input
                type="text"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                placeholder="e.g. Round 1 Quiz, Technical Interview"
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-primary)",
                  marginTop: "0.25rem",
                }}
              />
            </div>

            <div style={{ minWidth: "160px" }}>
              <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                Badge Color
              </label>
              <select
                value={newStageColor}
                onChange={(e) => setNewStageColor(e.target.value as any)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-primary)",
                  marginTop: "0.25rem",
                }}
              >
                {COLOR_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: "1.25rem" }}>
              <button type="submit" className="btn btn-outline">
                + Add Stage
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
