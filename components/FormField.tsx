"use client";

import styles from "./FormField.module.css";

interface Option {
  value: string;
  label: string;
}

interface FormFieldProps {
  id: string;
  label: string;
  type?: "text" | "number" | "email" | "tel" | "url" | "textarea" | "select" | "radio" | "checkbox";
  options?: Option[];
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}

export default function FormField({
  id,
  label,
  type = "text",
  options = [],
  required = false,
  placeholder,
  value,
  onChange,
  error,
  hint,
}: FormFieldProps) {
  const inputId = `field-${id}`;

  return (
    <div className={styles.field}>
      <label htmlFor={type !== "radio" ? inputId : undefined} className={styles.label}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>

      {hint && <p className={styles.hint}>{hint}</p>}

      {type === "textarea" && (
        <textarea
          id={inputId}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={error ? styles.inputError : ""}
        />
      )}

      {type === "select" && (
        <select
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={error ? styles.inputError : ""}
        >
          <option value="">Select an option</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {type === "radio" && (
        <div className={styles.radioGroup} role="radiogroup" aria-labelledby={`${inputId}-legend`}>
          <span id={`${inputId}-legend`} className="visually-hidden">{label}</span>
          {options.map((opt) => (
            <label key={opt.value} className={styles.radioLabel}>
              <input
                type="radio"
                name={id}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                className={styles.radioInput}
              />
              <span className={styles.radioMark} />
              {opt.label}
            </label>
          ))}
        </div>
      )}

      {type !== "textarea" && type !== "select" && type !== "radio" && (
        <input
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={error ? styles.inputError : ""}
        />
      )}

      {error && (
        <p id={`${inputId}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
