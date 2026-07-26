"use client";

import { FormFieldConfig } from "@/lib/firebase";
import FormField from "./FormField";
import styles from "@/app/register/register.module.css";

interface DynamicFormRendererProps {
  schema: FormFieldConfig[];
  formData: Record<string, any>;
  errors: Record<string, string | undefined>;
  onChange: (fieldId: string, value: any) => void;
}

export default function DynamicFormRenderer({
  schema,
  formData,
  errors,
  onChange,
}: DynamicFormRendererProps) {
  // Group schema fields into pairs for grid2 or full span
  const fields = [...schema];
  const renderedElements: React.ReactNode[] = [];

  let i = 0;
  while (i < fields.length) {
    const current = fields[i];

    if (current.gridSpan === 1 && i + 1 < fields.length && fields[i + 1].gridSpan === 1) {
      const next = fields[i + 1];
      renderedElements.push(
        <div key={`${current.id}-${next.id}`} className={styles.grid2}>
          <FormField
            id={current.id}
            label={current.label}
            type={current.type}
            placeholder={current.placeholder}
            required={current.required}
            options={current.options}
            hint={current.hint}
            value={formData[current.id] || ""}
            onChange={(val) => onChange(current.id, val)}
            error={errors[current.id]}
          />
          <FormField
            id={next.id}
            label={next.label}
            type={next.type}
            placeholder={next.placeholder}
            required={next.required}
            options={next.options}
            hint={next.hint}
            value={formData[next.id] || ""}
            onChange={(val) => onChange(next.id, val)}
            error={errors[next.id]}
          />
        </div>
      );
      i += 2;
    } else {
      renderedElements.push(
        <FormField
          key={current.id}
          id={current.id}
          label={current.label}
          type={current.type}
          placeholder={current.placeholder}
          required={current.required}
          options={current.options}
          hint={current.hint}
          value={formData[current.id] || ""}
          onChange={(val) => onChange(current.id, val)}
          error={errors[current.id]}
        />
      );
      i += 1;
    }
  }

  return <div className={styles.section}>{renderedElements}</div>;
}
