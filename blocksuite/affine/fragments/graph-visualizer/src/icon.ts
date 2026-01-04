import { html } from 'lit';
import type { TemplateResult } from 'lit';

// Graph view icon - interconnected nodes representing a network
export const GraphViewIcon: TemplateResult = html`
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <!-- Links between nodes -->
    <line x1="4" y1="4" x2="10" y2="10" stroke="currentColor" stroke-width="1.5" />
    <line x1="16" y1="4" x2="10" y2="10" stroke="currentColor" stroke-width="1.5" />
    <line x1="10" y1="10" x2="4" y2="16" stroke="currentColor" stroke-width="1.5" />
    <line x1="10" y1="10" x2="16" y2="16" stroke="currentColor" stroke-width="1.5" />
    <line x1="4" y1="16" x2="16" y2="16" stroke="currentColor" stroke-width="1.5" />

    <!-- Nodes -->
    <circle cx="4" cy="4" r="2.5" fill="currentColor" />
    <circle cx="16" cy="4" r="2.5" fill="currentColor" />
    <circle cx="10" cy="10" r="2.5" fill="currentColor" />
    <circle cx="4" cy="16" r="2.5" fill="currentColor" />
    <circle cx="16" cy="16" r="2.5" fill="currentColor" />
  </svg>
`;
