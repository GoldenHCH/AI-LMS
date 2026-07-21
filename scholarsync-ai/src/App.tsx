/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Header from './components/Header';
import LandingPage from './components/LandingPage';

export default function App() {
  return (
    <div className="flex flex-col min-h-screen bg-paper text-ink font-sans selection:bg-accent/15 selection:text-accent">
      <Header />
      <main className="flex-grow">
        <LandingPage />
      </main>
    </div>
  );
}
