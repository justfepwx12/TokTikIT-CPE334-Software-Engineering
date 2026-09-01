// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Button from '../../src/components/Button';
import TextInput from '../../src/components/TextInput';
import ValidationMessage from '../../src/components/ValidationMessage';

describe('Form Reusable UI Components', () => {
  afterEach(() => {
    cleanup();
  });

  describe('Button Component', () => {
    it('renders text children correctly', () => {
      render(<Button>Click Me</Button>);
      expect(screen.getByRole('button', { name: /click me/i })).toBeDefined();
    });

    it('applies primary styles by default', () => {
      const { container } = render(<Button>Primary</Button>);
      const button = container.querySelector('button');
      expect(button?.className).toContain('primary');
    });

    it('applies secondary styles when variant is secondary', () => {
      const { container } = render(<Button variant="secondary">Secondary</Button>);
      const button = container.querySelector('button');
      expect(button?.className).toContain('secondary');
    });

    it('handles disabled state with correct accessibility attributes', () => {
      const handleClick = vi.fn();
      const { container } = render(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.tabIndex).toBe(-1);

      fireEvent.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('handles loading state with spinner and loading text', () => {
      render(
        <Button isLoading loadingText="Saving...">
          Submit
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.tabIndex).toBe(-1);

      // It should display the loading text instead of original child text
      expect(screen.getByText('Saving...')).toBeDefined();
      expect(screen.queryByText('Submit')).toBeNull();

      // Ensure the SVG spinner is present
      const svg = button.querySelector('svg');
      expect(svg).toBeDefined();
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
    });

    it('uses default loading text "Submitting..." if loadingText is not provided', () => {
      render(<Button isLoading>Submit</Button>);
      expect(screen.getByText('Submitting...')).toBeDefined();
    });
  });

  describe('TextInput Component', () => {
    it('renders a standard input element', () => {
      render(<TextInput placeholder="Enter text..." />);
      expect(screen.getByPlaceholderText('Enter text...')).toBeDefined();
    });

    it('renders a label and associates it with the input via htmlFor', () => {
      render(<TextInput label="Username" id="user-input" />);
      const label = screen.getByText('Username');
      const input = screen.getByLabelText('Username');

      expect(label.getAttribute('for')).toBe('user-input');
      expect(input.id).toBe('user-input');
    });

    it('displays validation-error message and sets error states when error is a string', () => {
      const { container } = render(
        <TextInput label="Email" id="email-input" error="Invalid email address" />
      );

      const input = screen.getByLabelText('Email');
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')).toBe('email-input-error');

      const errorMessage = screen.getByText('Invalid email address');
      expect(errorMessage).toBeDefined();
      expect(errorMessage.getAttribute('role')).toBe('alert');

      const inputEl = container.querySelector('input');
      expect(inputEl?.className).toContain('errorInput');
    });

    it('shows a red required asterisk next to the label as a visual aid only (aria-hidden)', () => {
      render(<TextInput label="Password" required />);
      const asterisk = screen.getByTestId('required-asterisk');
      expect(asterisk).toBeDefined();
      expect(asterisk.textContent).toBe('*');
      expect(asterisk.getAttribute('aria-hidden')).toBe('true');
    });

    it('supports read-only state, setting readOnly, removing from tab order, and using ivory/gray-green shading class', () => {
      const { container } = render(<TextInput label="Ticket ID" readOnly value="TICKET-123" />);
      const input = screen.getByLabelText('Ticket ID');

      expect(input).toHaveProperty('readOnly', true);
      expect(input.tabIndex).toBe(-1);

      const inputEl = container.querySelector('input');
      expect(inputEl?.className).toContain('readOnlyInput');
    });

    it('supports disabled state and sets disabled attribute', () => {
      render(<TextInput label="System" disabled />);
      const input = screen.getByLabelText('System');
      expect(input).toBeDisabled();
    });
  });

  describe('ValidationMessage Component', () => {
    it('renders error message correctly with role="alert"', () => {
      render(<ValidationMessage id="err-id">This is a custom error</ValidationMessage>);
      const msg = screen.getByText('This is a custom error');
      expect(msg).toBeDefined();
      expect(msg.getAttribute('role')).toBe('alert');
    });

    it('does not render anything if children are empty/null', () => {
      const { container } = render(<ValidationMessage />);
      expect(container.firstChild).toBeNull();
    });
  });
});