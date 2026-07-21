/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// vite.config.ts already refuses to produce a production build unless
// VITE_DEMO_REQUEST_URL is a valid HTTPS URL, so this value is trustworthy
// in anything actually deployed. The "#" fallback only exists so `npm run
// dev` still renders before a contributor has set up their local .env.
const rawDemoUrl = import.meta.env.VITE_DEMO_REQUEST_URL;

function resolveDemoRequestUrl(value: string | undefined): string {
  if (!value) {
    if (import.meta.env.DEV) {
      console.warn(
        'VITE_DEMO_REQUEST_URL is not set. "Request a Demo" links will be inert until you add it to .env.local (see .env.example).',
      );
      return '#';
    }
    throw new Error('VITE_DEMO_REQUEST_URL is required.');
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') {
      throw new Error('not https');
    }
    return parsed.toString();
  } catch {
    throw new Error(`VITE_DEMO_REQUEST_URL must be a valid HTTPS URL, got: "${value}"`);
  }
}

export const DEMO_REQUEST_URL = resolveDemoRequestUrl(rawDemoUrl);
