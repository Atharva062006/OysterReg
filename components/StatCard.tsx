import styles from "./StatCard.module.css";

interface StatCardProps {
  label: string;
  value: number | string;
  sub?: string;
}

export default function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className={styles.card}>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
      {sub && <span className={styles.sub}>{sub}</span>}
    </div>
  );
}
