import React from 'react';
import styles from './ValidationMessage.module.css';

export interface ValidationMessageProps {
  children?: React.ReactNode;
  className?: string;
  id?: string;
}

export default function ValidationMessage({
  children,
  className = '',
  id,
}: ValidationMessageProps) {
  if (!children) return null;

  return (
    <div id={id} className={`${styles.message} ${className}`.trim()} role="alert">
      {children}
    </div>
  );
}
