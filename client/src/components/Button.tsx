import React from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  isLoading?: boolean;
  loadingText?: string;
}

export default function Button({
  variant = 'primary',
  isLoading = false,
  loadingText,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const isButtonDisabled = disabled || isLoading;
  const computedClassName = `${styles.button} ${styles[variant]} ${className}`.trim();

  return (
    <button
      {...props}
      disabled={isButtonDisabled}
      aria-disabled={isButtonDisabled ? 'true' : undefined}
      tabIndex={isButtonDisabled ? -1 : props.tabIndex}
      className={computedClassName}
    >
      {isLoading ? (
        <span className={styles.loadingWrapper}>
          <svg
            className={styles.spinner}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className={styles.spinnerTrack}
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className={styles.spinnerHead}
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className={styles.loadingText}>{loadingText || 'Submitting...'}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
