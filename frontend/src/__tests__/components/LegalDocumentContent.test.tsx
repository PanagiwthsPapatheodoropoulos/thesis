// @ts-nocheck
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LegalDocumentContent from '../../components/LegalDocumentContent';
describe('LegalDocumentContent', () => {
  const mockDarkMode = false;

  it('renders terms document correctly', () => {
    render(
      <LegalDocumentContent 
        documentType="terms" 
        darkMode={mockDarkMode} 
      />
    );

    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
    // Use a more flexible matcher for the summary text that may be split across elements
    expect(screen.getByText(/Rules that define acceptable use/)).toBeInTheDocument();
  });

  it('renders privacy document correctly', () => {
    render(
      <LegalDocumentContent 
        documentType="privacy" 
        darkMode={mockDarkMode} 
      />
    );

    expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
    // Use a more flexible matcher for the summary text that may be split across elements
    expect(screen.getByText(/How personal and operational data/)).toBeInTheDocument();
  });

  it('renders terms document with dark mode', () => {
    render(
      <LegalDocumentContent 
        documentType="terms" 
        darkMode={true} 
      />
    );

    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
  });

  it('renders with compact mode', () => {
    render(
      <LegalDocumentContent 
        documentType="terms" 
        darkMode={mockDarkMode} 
        compact={true}
      />
    );

    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
  });
});