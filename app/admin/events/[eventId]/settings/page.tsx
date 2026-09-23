"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getEventById,
  updateEvent,
  toggleEventRegistration,
  setActiveEvent,
  deleteEvent,
  Event,
} from "@/lib/firebase";
import EventAdminNav from "@/components/EventAdminNav";
import styles from "@/app/admin/admin.module.css";

interface SettingsPageProps {
  params: Promise<{ eventId: string }>;
}

export default function SettingsPage({ params }: SettingsPageProps) {
  const resolvedParams = use(params);
  const eventId = resolvedParams.eventId;

  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [closedMessage, setClosedMessage] = useState("");
  const [whatsappGroupLink, setWhatsappGroupLink] = useState("");
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [registrationFee, setRegistrationFee] = useState<number | "">("");
  const [pricingType, setPricingType] = useState<"fixed" | "dynamic">("fixed");
  const [pricingFieldId, setPricingFieldId] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      setName(ev.name);
      setDescription(ev.description || "");
      setClosedMessage(ev.closedMessage || "Registrations for this event are currently closed.");
      setWhatsappGroupLink(ev.whatsappGroupLink || "");
      setRegistrationOpen(ev.registrationOpen);
      setRazorpayEnabled(!!ev.razorpayEnabled);
      setRegistrationFee(ev.registrationFee !== undefined ? ev.registrationFee : "");
      setPricingType(ev.pricingType ?? "fixed");
      setPricingFieldId(ev.pricingFieldId ?? "");
    } catch (err) {
      console.error(err);
      setError("Failed to load settings.");
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

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    setError("");

    try {
      await updateEvent(eventId, {
        name: name.trim(),
        description: description.trim(),
        closedMessage: closedMessage.trim(),
        whatsappGroupLink: whatsappGroupLink.trim(),
        registrationOpen,
        razorpayEnabled,
        registrationFee: razorpayEnabled && registrationFee !== "" ? Number(registrationFee) : 0,
        pricingType: razorpayEnabled ? pricingType : "fixed",
        pricingFieldId: razorpayEnabled && pricingType === "dynamic" ? pricingFieldId.trim() : "",
      });
      setSuccess("Event settings updated successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive() {
    try {
      await setActiveEvent(eventId);
      setEvent((prev) => (prev ? { ...prev, isActive: true } : prev));
      setSuccess("Set as the active primary site registration event.");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      alert("Failed to set active event.");
    }
  }

  async function handleDelete() {
    if (eventId === "recruitment-2026") {
      alert("The default Recruitment 2026 event cannot be deleted.");
      return;
    }
    if (!confirm(`Delete "${name}" and all its candidate registrations? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteEvent(eventId);
      router.push("/admin");
    } catch (err: any) {
      alert(err.message || "Failed to delete event.");
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        <p>Loading settings…</p>
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
              <h1 className={styles.pageTitle}>Event Settings & Control</h1>
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

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>General Settings</h2>

          <form
            onSubmit={handleSaveSettings}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              marginTop: "1rem",
            }}
          >
            <div>
              <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                Event Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-primary)",
                  marginTop: "0.375rem",
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-primary)",
                  marginTop: "0.375rem",
                }}
              />
            </div>
            
            <div>
              <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                WhatsApp Group Link (Optional)
              </label>
              <input
                type="url"
                value={whatsappGroupLink}
                onChange={(e) => setWhatsappGroupLink(e.target.value)}
                placeholder="e.g. https://chat.whatsapp.com/..."
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-primary)",
                  marginTop: "0.375rem",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, color: "var(--text-primary)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={registrationOpen}
                  onChange={(e) => setRegistrationOpen(e.target.checked)}
                />
                Allow Public Candidate Registrations (Open / Closed)
              </label>
            </div>

            {!registrationOpen && (
              <div>
                <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Registrations Closed Message
                </label>
                <input
                  type="text"
                  value={closedMessage}
                  onChange={(e) => setClosedMessage(e.target.value)}
                  placeholder="Message displayed to candidates when form is closed"
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-primary)",
                    marginTop: "0.375rem",
                  }}
                />
              </div>
            )}

            {/* Razorpay Payment Integration Section */}
            <div
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: "1.25rem",
                marginTop: "0.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  Payment Integration (Razorpay)
                </h3>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
                  Enable payment collection for registrations. Free events do not require Razorpay.
                </p>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={razorpayEnabled}
                  onChange={(e) => setRazorpayEnabled(e.target.checked)}
                />
                Require Paid Registration (Razorpay)
              </label>

              {razorpayEnabled && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {/* Pricing Mode Toggle */}
                  <div>
                    <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Pricing Mode
                    </label>
                    <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.875rem" }}>
                        <input
                          type="radio"
                          name="pricingType"
                          value="fixed"
                          checked={pricingType === "fixed"}
                          onChange={() => setPricingType("fixed")}
                        />
                        Flat Fee (same for everyone)
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontSize: "0.875rem" }}>
                        <input
                          type="radio"
                          name="pricingType"
                          value="dynamic"
                          checked={pricingType === "dynamic"}
                          onChange={() => setPricingType("dynamic")}
                        />
                        Dynamic (price per form option)
                      </label>
                    </div>
                  </div>

                  {/* Fixed Fee Input */}
                  {pricingType === "fixed" && (
                    <div style={{ maxWidth: "300px" }}>
                      <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                        Registration Fee (₹ INR) *
                      </label>
                      <div style={{ position: "relative", marginTop: "0.375rem" }}>
                        <span
                          style={{
                            position: "absolute",
                            left: "0.75rem",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "var(--text-muted)",
                            fontWeight: 600,
                          }}
                        >
                          ₹
                        </span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          required={razorpayEnabled && pricingType === "fixed"}
                          value={registrationFee}
                          onChange={(e) => setRegistrationFee(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="e.g. 200"
                          style={{
                            width: "100%",
                            padding: "0.75rem 1rem 0.75rem 2rem",
                            background: "var(--bg)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            color: "var(--text-primary)",
                            fontWeight: 600,
                          }}
                        />
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                        Amount charged per applicant prior to recording registration.
                      </p>
                    </div>
                  )}

                  {/* Dynamic Pricing: pricing field selector */}
                  {pricingType === "dynamic" && (
                    <div style={{ maxWidth: "420px" }}>
                      <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                        Pricing Field ID *
                      </label>
                      {event && event.formSchema.filter((f) => f.type === "select" || f.type === "radio").length > 0 ? (
                        <select
                          value={pricingFieldId}
                          onChange={(e) => setPricingFieldId(e.target.value)}
                          required={pricingType === "dynamic"}
                          style={{
                            width: "100%",
                            padding: "0.75rem 1rem",
                            background: "var(--bg)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-md)",
                            color: "var(--text-primary)",
                            marginTop: "0.375rem",
                          }}
                        >
                          <option value="">— Select a field —</option>
                          {event.formSchema
                            .filter((f) => f.type === "select" || f.type === "radio")
                            .map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.label} (ID: {f.id})
                              </option>
                            ))}
                        </select>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={pricingFieldId}
                            onChange={(e) => setPricingFieldId(e.target.value)}
                            placeholder="e.g. entry_type"
                            required={pricingType === "dynamic"}
                            style={{
                              width: "100%",
                              padding: "0.75rem 1rem",
                              background: "var(--bg)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-md)",
                              color: "var(--text-primary)",
                              marginTop: "0.375rem",
                            }}
                          />
                          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                            No select/radio fields found in form schema. Enter the field ID manually, or add a select/radio field in the Form Builder first.
                          </p>
                        </>
                      )}
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
                        Each option on this field must have a price set in the Form Builder. The price is resolved securely on the server — users cannot tamper with it.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <button type="submit" disabled={saving} className="btn btn-primary" id="save-settings-btn">
                {saving ? "Saving Settings..." : "Save Settings"}
              </button>
            </div>
          </form>
        </section>

        {/* Primary Site Registration Control */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Primary Site Registration Control</h2>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "1.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                {event.isActive ? "This event is currently set as the Primary Site Registration." : "This event is not the primary registration."}
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                Setting this as active routes default <code>/register</code> to this event form.
              </div>
            </div>
            {!event.isActive && (
              <button onClick={handleSetActive} className="btn btn-outline">
                Set as Active Site Registration
              </button>
            )}
          </div>
        </section>

        {/* Danger Zone */}
        {eventId !== "recruitment-2026" && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle} style={{ color: "var(--danger)" }}>Danger Zone</h2>
            <div
              style={{
                background: "rgba(239, 68, 68, 0.05)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "var(--radius-lg)",
                padding: "1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "1rem",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: "var(--danger)" }}>Delete Event</div>
                <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                  Permanently delete this event and all associated registration records.
                </div>
              </div>
              <button
                onClick={handleDelete}
                className="btn btn-primary"
                style={{ background: "var(--danger)", borderColor: "var(--danger)" }}
              >
                Delete Event
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
