import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig, loadEnv} from 'vite';

// Fails `vite build` (production mode) outright if the demo-request URL is
// missing or malformed, so a broken CTA can never reach a deployed build.
function assertValidDemoUrl(env: Record<string, string>) {
  const value = env.VITE_DEMO_REQUEST_URL;
  if (!value) {
    throw new Error(
      'VITE_DEMO_REQUEST_URL is required for production builds. Set it to the HTTPS URL of the demo request form.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`VITE_DEMO_REQUEST_URL must be a valid URL, got: "${value}"`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`VITE_DEMO_REQUEST_URL must use HTTPS, got: "${value}"`);
  }
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  if (mode === 'production') {
    assertValidDemoUrl(env);
  }

  return {
    plugins: [react(), tailwindcss()],
  };
});
