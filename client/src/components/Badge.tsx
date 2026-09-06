import styles from './Badge.module.css';

export type BadgeColor = 'green' | 'yellow' | 'red' | 'blue' | 'gray';

export interface BadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  className?: string;
}

export default function Badge({ children, color = 'gray', className = '' }: BadgeProps) {
  const combinedClassName = `${styles.badge} ${styles[color]} ${className}`.trim();
  
  return (
    <span className={combinedClassName}>
      {children}
    </span>
  );
}