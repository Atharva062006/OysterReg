"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { submitRegistration } from "@/lib/firebase";
import FormField from "@/components/FormField";
import styles from "./page.module.css";

const DEPARTMENTS = [
  { value: "CSE", label: "Computer Science & Engineering" },
  { value: "CSE AIML", label: "Artificial Intelligence & Machine Learning" },
  { value: "IT", label: "Information Technology" },
  { value: "ENTC", label: "Electronics & Telecommunication" },
  { value: "EE", label: "Electrical Engineering" },
  { value: "MECH", label: "Mechanical Engineering" },
  { value: "ROBOTICS", label: "Robotics & Automation" },
  { value: "MECHATRONICS", label: "Mechatronics" },
  { value: "CIVIL", label: "Civil Engineering" },
  { value: "OTHER", label: "Other" },
];

const YEARS = [
  { value: "1st", label: "1st Year" },
  { value: "2nd", label: "2nd Year" },
  { value: "3rd", label: "3rd Year" },
  { value: "4th", label: "4th Year" },
];

const GENDERS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Prefer not to say", label: "Prefer not to say" },
];

const CODED = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

interface FormState {
  name: string;
  rollNumber: string;
  email: string;
  phone: string;
  department: string;
  year: string;
  gender: string;
  whyJoin: string;
  hasCodedBefore: string;
  portfolioUrl: string;
}

type FormErrors = Partial<FormState>;

const INITIAL: FormState = {
  name: "",
  rollNumber: "",
  email: "",
  phone: "",
  department: "",
  year: "",
  gender: "",
  whyJoin: "",
  hasCodedBefore: "",
  portfolioUrl: "",
};

function validate(f: FormState): FormErrors {
  const e: FormErrors = {};
  if (!f.name.trim()) e.name = "Name is required.";
  if (!f.rollNumber.trim()) e.rollNumber = "Roll number is required.";
  if (!f.email.trim()) e.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "Enter a valid email address.";
  if (!f.phone.trim()) e.phone = "Phone number is required.";
  else if (!/^\d{10}$/.test(f.phone.replace(/\s/g, ""))) e.phone = "Enter a valid 10-digit phone number.";
  if (!f.department) e.department = "Please select your department.";
  if (!f.year) e.year = "Please select your year.";
  if (!f.gender) e.gender = "Please select an option.";
  if (!f.hasCodedBefore) e.hasCodedBefore = "Please select an option.";
  if (!f.whyJoin.trim()) e.whyJoin = "Please tell us why you want to join.";
  return e;
}

export default function RegistrationPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(field: keyof FormState) {
    return (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      const firstErrorField = document.querySelector("[aria-invalid], [role='alert']");
      firstErrorField?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setLoading(true);
    setSubmitError("");

    try {
      await submitRegistration({
        name: form.name.trim(),
        rollNumber: form.rollNumber.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        department: form.department,
        year: form.year,
        gender: form.gender,
        whyJoin: form.whyJoin.trim(),
        hasCodedBefore: form.hasCodedBefore === "yes",
        portfolioUrl: form.portfolioUrl.trim(),
      });
      router.push("/success");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setSubmitError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.logoRow}>
            <Image src="/logo1.svg" alt="Oyster Kode Club" width={40} height={40} />
            <div className={styles.clubTag}>Oyster Kode Club</div>
          </div>
          <h1 className={styles.title}>Recruitment 2026</h1>
          <p className={styles.subtitle}>
            Fill out the form below to apply. We will reach out to shortlisted candidates
            with details about the selection process.
          </p>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Personal Information</h2>
            <div className={styles.grid2}>
              <FormField
                id="name"
                label="Full Name"
                placeholder="Your full name"
                required
                value={form.name}
                onChange={set("name")}
                error={errors.name}
              />
              <FormField
                id="rollNumber"
                label="Roll Number"
                placeholder="e.g. 2403036"
                required
                value={form.rollNumber}
                onChange={set("rollNumber")}
                error={errors.rollNumber}
              />
            </div>
            <div className={styles.grid2}>
              <FormField
                id="email"
                label="Email Address"
                type="email"
                placeholder="your@email.com"
                required
                value={form.email}
                onChange={set("email")}
                error={errors.email}
              />
              <FormField
                id="phone"
                label="Phone Number"
                type="tel"
                placeholder="10-digit mobile number"
                required
                value={form.phone}
                onChange={set("phone")}
                error={errors.phone}
              />
            </div>
            <FormField
              id="gender"
              label="Gender"
              type="radio"
              options={GENDERS}
              required
              value={form.gender}
              onChange={set("gender")}
              error={errors.gender}
            />
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Academic Details</h2>
            <div className={styles.grid2}>
              <FormField
                id="department"
                label="Department"
                type="select"
                options={DEPARTMENTS}
                required
                value={form.department}
                onChange={set("department")}
                error={errors.department}
              />
              <FormField
                id="year"
                label="Year of Study"
                type="select"
                options={YEARS}
                required
                value={form.year}
                onChange={set("year")}
                error={errors.year}
              />
            </div>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>About You</h2>
            <FormField
              id="hasCodedBefore"
              label="Have you coded before?"
              type="radio"
              options={CODED}
              required
              value={form.hasCodedBefore}
              onChange={set("hasCodedBefore")}
              error={errors.hasCodedBefore}
            />
            <FormField
              id="portfolioUrl"
              label="GitHub / Portfolio URL"
              type="url"
              placeholder="https://github.com/yourhandle"
              value={form.portfolioUrl}
              onChange={set("portfolioUrl")}
              hint="Optional — share your work if you have any."
            />
            <FormField
              id="whyJoin"
              label="Why do you want to join?"
              type="textarea"
              placeholder="In 2-3 sentences, tell us what draws you to the club..."
              required
              value={form.whyJoin}
              onChange={set("whyJoin")}
              error={errors.whyJoin}
            />
          </section>

          {submitError && (
            <div className={styles.submitError} role="alert">
              {submitError}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="submit"
              id="submit-btn"
              disabled={loading}
              className={`btn btn-primary ${styles.submitBtn}`}
            >
              {loading ? "Submitting..." : "Submit Application"}
            </button>
            <p className={styles.disclaimer}>
              Your information will only be used for recruitment purposes.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
