import React from 'react';
import styles from './TextInput.module.css';
import ValidationMessage from './ValidationMessage';

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | boolean;
  required?: boolean;
}

export default function TextInput({
  label,
  error,
  required,
  id,
  className = '',
  disabled,
  readOnly,
  ...props
}: TextInputProps) {
  const isError = !!error;
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined);

  const inputClasses = [
    styles.input,
    isError ? styles.errorInput : '',
    readOnly ? styles.readOnlyInput : '',
    className
  ].filter(Boolean).join(' ');

  const wrapperClasses = [
    styles.wrapper,
    disabled ? styles.disabledWrapper : '',
  ].filter(Boolean).join(' ');

  // Read-only fields are excluded from tab order per specification
  const tabIndex = readOnly ? -1 : props.tabIndex;

  return (
    <div className={wrapperClasses}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {required && (
            <span className={styles.asterisk} aria-hidden="true" data-testid="required-asterisk">
              *
            </span>
          )}
        </label>
      )}
      <input
        {...props}
        id={inputId}
        disabled={disabled}
        readOnly={readOnly}
        tabIndex={tabIndex}
        className={inputClasses}
        aria-invalid={isError ? 'true' : 'false'}
        aria-describedby={isError && inputId ? `${inputId}-error` : undefined}
      />
      {isError && typeof error === 'string' && (
        <div id={inputId ? `${inputId}-error` : undefined} className={styles.errorWrapper}>
          <ValidationMessage>{error}</ValidationMessage>
        </div>
      )}
    </div>
  );
}
