// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Badge from '../../src/components/Badge';

describe('Badge Component', () => {
  it('renders text children correctly', () => {
    render(<Badge>High Priority</Badge>);
    expect(screen.getByText('High Priority')).toBeDefined();
  });

  it('applies the default gray class when no color is provided', () => {
    const { container } = render(<Badge>Pending</Badge>);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('gray');
  });

  it('applies the correct color class based on props', () => {
    const { container } = render(<Badge color="red">High</Badge>);
    const badge = container.querySelector('span');
    expect(badge?.className).toContain('red');
  });
});