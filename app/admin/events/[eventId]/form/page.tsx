"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getEventById,
  saveEventFormSchema,
  Event,
  FormFieldConfig,
  DEFAULT_RECRUITMENT_FORM_SCHEMA,
  WORKSHOP_FORM_SCHEMA_PRESET,
} from "@/lib/firebase";
import EventAdminNav from "@/components/EventAdminNav";
import DynamicFormRenderer from "@/components/DynamicFormRenderer";
import styles from "@/app/admin/admin.module.css";

interface FormBuilderPageProps {
  params: Promise<{ eventId: string }>;
}

const FIELD_TYPES: { value: FormFieldConfig["type"]; label: string }[] = [
  { value: "text", label: "Single-line Text" },
  { value: "email", label: "Email Address" },
  { value: "tel", label: "Phone Number" },
  { value: "number", label: "Number" },
  { value: "url", label: "Web URL / Link" },
  { value: "textarea", label: "Multi-line Textarea" },
  { value: "select", label: "Dropdown Select" },
  { value: "radio", label: "Radio Options" },
  { value: "file", label: "File Upload (PDF)" },
];

export default function FormBuilderPage({ params }: FormBuilderPageProps) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.eventId;

  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [formSchema, setFormSchema] = useState<FormFieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Tab: "builder" or "preview"
  const [activeTab, setActiveTab] = useState<"builder" | "preview">("builder");

  // New field state
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<FormFieldConfig["type"]>("text");
  const [newPlaceholder, setNewPlaceholder] = useState("");
  const [newRequired, setNewRequired] = useState(true);
  const [newPanelVisible, setNewPanelVisible] = useState(false);
  const [newOptionsText, setNewOptionsText] = useState("");
  const [newHint, setNewHint] = useState("");
  const [newSpan, setNewSpan] = useState<1 | 2>(1);

  // Preview form test state
  const [previewData, setPreviewData] = useState<Record<string, any>>({});

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
      setFormSchema(ev.formSchema || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load form configuration.");
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

  function handleAddField(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;

    const id = newLabel
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (formSchema.some((f) => f.id === id)) {
      alert("A field with a similar label/ID already exists.");
      return;
    }

    let options: { value: string; label: string }[] | undefined = undefined;
    if (newType === "select" || newType === "radio") {
      options = newOptionsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((opt) => ({ value: opt, label: opt }));
      if (!options || options.length === 0) {
        alert("Please provide at least one option (comma separated).");
        return;
      }
    }

    const field: FormFieldConfig = {
      id,
      label: newLabel.trim(),
      type: newType,
      placeholder: newPlaceholder.trim() || undefined,
      required: newRequired,
      options,
      hint: newHint.trim() || undefined,
      gridSpan: newSpan,
      panelVisible: newPanelVisible,
    };

    setFormSchema((prev) => [...prev, field]);
    setNewLabel("");
    setNewPlaceholder("");
    setNewOptionsText("");
    setNewHint("");
    setNewPanelVisible(false);
  }

  function handleTogglePanelVisible(id: string) {
    setFormSchema((prev) =>
      prev.map((field) =>
        field.id === id ? { ...field, panelVisible: !field.panelVisible } : field
      )
    );
  }

  function handleRemoveField(id: string) {
    if (formSchema.length <= 1) {
      alert("A registration form must have at least 1 field.");
      return;
    }
    setFormSchema((prev) => prev.filter((f) => f.id !== id));
  }

  function handleMoveField(index: number, direction: "up" | "down") {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === formSchema.length - 1)
    ) {
      return;
    }
    const next = [...formSchema];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    setFormSchema(next);
  }

  function handleHotswapPreset(presetName: "recruitment" | "workshop") {
    if (
      !confirm(
        `Are you sure you want to replace current form fields with the "${presetName.toUpperCase()}" template preset?`
      )
    ) {
      return;
    }

    if (presetName === "recruitment") {
      setFormSchema(DEFAULT_RECRUITMENT_FORM_SCHEMA);
    } else if (presetName === "workshop") {
      setFormSchema(WORKSHOP_FORM_SCHEMA_PRESET);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSuccess("");
    setError("");
    try {
      await saveEventFormSchema(eventId, formSchema);
      setSuccess("Registration form schema saved successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save form schema.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Loading form builder…</p>
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
              <h1 className={styles.pageTitle}>Dynamic Form Builder & Hotswapper</h1>
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

        {/* Builder / Preview Tabs */}
        <section className={styles.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => setActiveTab("builder")}
                className={`btn ${activeTab === "builder" ? "btn-primary" : "btn-outline"}`}
              >
                Form Schema Builder
              </button>
              <button
                onClick={() => setActiveTab("preview")}
                className={`btn ${activeTab === "preview" ? "btn-primary" : "btn-outline"}`}
              >
                Live Form Preview
              </button>
            </div>

            <button onClick={handleSave} disabled={saving} className="btn btn-primary" id="save-form-btn">
              {saving ? "Saving Schema..." : "Save Form Schema"}
            </button>
          </div>
        </section>

        {/* BUILDER TAB */}
        {activeTab === "builder" && (
          <>
            {/* Presets Hotswapper */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Hotswap Preset Templates</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1rem" }}>
                Apply pre-built form templates in 1 click:
              </p>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => handleHotswapPreset("recruitment")}
                  className="btn btn-outline"
                >
                  Apply Standard Recruitment Preset
                </button>
                <button
                  onClick={() => handleHotswapPreset("workshop")}
                  className="btn btn-outline"
                >
                  Apply Workshop RSVP Preset
                </button>
              </div>
            </section>

            {/* Current Fields List */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Configured Form Fields ({formSchema.length})</h2>

              <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                {formSchema.map((field, index) => (
                  <div
                    key={field.id}
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
                    <div style={{ flex: 1, minWidth: "240px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{field.label}</span>
                        {field.required && <span style={{ color: "var(--danger)", fontSize: "0.75rem" }}>*Required</span>}
                        {field.panelVisible && <span style={{ color: "var(--accent)", fontSize: "0.75rem", border: "1px solid var(--accent)", padding: "0.1rem 0.3rem", borderRadius: "var(--radius-sm)" }}>👁 Panel Visible</span>}
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            background: "var(--bg)",
                            padding: "0.15rem 0.4rem",
                            borderRadius: "var(--radius-sm)",
                            color: "var(--text-muted)",
                            textTransform: "uppercase",
                          }}
                        >
                          {field.type}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                        ID: <code>{field.id}</code> | Span: {field.gridSpan || 1} col
                        {field.options && ` | Options: ${field.options.map((o) => o.label).join(", ")}`}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <button
                        onClick={() => handleMoveField(index, "up")}
                        disabled={index === 0}
                        className="btn btn-sm btn-outline"
                        title="Move Up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleMoveField(index, "down")}
                        disabled={index === formSchema.length - 1}
                        className="btn btn-sm btn-outline"
                        title="Move Down"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => handleTogglePanelVisible(field.id)}
                        className="btn btn-sm btn-outline"
                        style={{ color: field.panelVisible ? "var(--text-muted)" : "var(--accent)", borderColor: field.panelVisible ? "var(--border)" : "rgba(59, 130, 246, 0.3)" }}
                        title={field.panelVisible ? "Hide from Panel" : "Show in Panel"}
                      >
                        {field.panelVisible ? "👁 Hide" : "👁 Show"}
                      </button>
                      <button
                        onClick={() => handleRemoveField(field.id)}
                        className="btn btn-sm btn-outline"
                        style={{ color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                        title="Remove Field"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Add Custom Field Form */}
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Add Custom Field</h2>
              <form
                onSubmit={handleAddField}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Field Label *
                    </label>
                    <input
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="e.g. T-Shirt Size, GitHub Profile"
                      required
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--text-primary)",
                        marginTop: "0.25rem",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Field Type
                    </label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as any)}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--text-primary)",
                        marginTop: "0.25rem",
                      }}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {(newType === "select" || newType === "radio") && (
                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Options (Comma separated) *
                    </label>
                    <input
                      type="text"
                      value={newOptionsText}
                      onChange={(e) => setNewOptionsText(e.target.value)}
                      placeholder="e.g. Small, Medium, Large, XL"
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--text-primary)",
                        marginTop: "0.25rem",
                      }}
                    />
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Placeholder Text
                    </label>
                    <input
                      type="text"
                      value={newPlaceholder}
                      onChange={(e) => setNewPlaceholder(e.target.value)}
                      placeholder="e.g. Select your size..."
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--text-primary)",
                        marginTop: "0.25rem",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Layout Width
                    </label>
                    <select
                      value={newSpan}
                      onChange={(e) => setNewSpan(Number(e.target.value) as 1 | 2)}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        background: "var(--bg)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--text-primary)",
                        marginTop: "0.25rem",
                      }}
                    >
                      <option value={1}>Half Width (1 Column)</option>
                      <option value={2}>Full Width (2 Columns)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--text-primary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={newRequired}
                      onChange={(e) => setNewRequired(e.target.checked)}
                    />
                    Field is Required
                  </label>
                  
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--text-primary)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={newPanelVisible}
                      onChange={(e) => setNewPanelVisible(e.target.checked)}
                    />
                    Show in Panel View
                  </label>
                </div>

                <div>
                  <button type="submit" className="btn btn-outline" style={{ marginTop: "0.5rem" }}>
                    + Add Field to Schema
                  </button>
                </div>
              </form>
            </section>
          </>
        )}

        {/* PREVIEW TAB */}
        {activeTab === "preview" && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Live Form Candidate Preview</h2>
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "2rem",
                maxWidth: "680px",
                margin: "1rem auto 0",
              }}
            >
              <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                {event.name}
              </h1>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "2rem" }}>
                {event.description || "Fill out the registration form below."}
              </p>

              <DynamicFormRenderer
                schema={formSchema}
                formData={previewData}
                errors={{}}
                onChange={(fieldId, val) =>
                  setPreviewData((prev) => ({ ...prev, [fieldId]: val }))
                }
              />

              <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
                <button type="button" className="btn btn-primary" style={{ width: "100%" }}>
                  Submit Registration (Preview Only)
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
