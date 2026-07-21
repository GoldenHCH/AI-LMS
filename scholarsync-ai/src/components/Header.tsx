/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {ArrowRight, GraduationCap} from 'lucide-react';
import {DEMO_REQUEST_URL} from '../config';

export default function Header() {
  return (
    <header className="bg-paper sticky top-0 border-b border-editorial-line z-50 transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16 sm:h-20">
        {/* Logo and Brand */}
        <button
          onClick={() => {
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth'});
          }}
          className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 hover:opacity-90 transition-opacity outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent cursor-pointer text-left rounded"
          id="btn-logo-home"
        >
          <GraduationCap className="text-accent shrink-0" size={26} strokeWidth={2} aria-hidden="true" />
          <span className="font-serif text-lg sm:text-2xl font-bold tracking-tight text-ink whitespace-nowrap">
            ScholarSync AI
          </span>
        </button>

        {/* Navigation */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-8 text-ink/75 font-semibold text-xs uppercase tracking-widest"
        >
          <a
            href="#platform"
            className="outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent hover:text-accent hover:underline decoration-accent/50 transition-all duration-200 rounded"
          >
            Platform
          </a>
          <a
            href="#solutions"
            className="outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent hover:text-accent hover:underline decoration-accent/50 transition-all duration-200 rounded"
          >
            Solutions
          </a>
        </nav>

        {/* Call to Action */}
        <div className="flex items-center gap-4 shrink-0">
          <a
            href={DEMO_REQUEST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-ink text-paper border border-ink hover:bg-transparent hover:text-ink outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent px-3 py-2 sm:px-5 sm:py-2.5 rounded text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-sm whitespace-nowrap"
            id="btn-demo-request"
          >
            <span className="sm:hidden">
              Demo<span className="sr-only"> request (opens in a new tab)</span>
            </span>
            <span className="hidden sm:inline">
              Request a Demo<span className="sr-only"> (opens in a new tab)</span>
            </span>
            <ArrowRight size={12} strokeWidth={2.5} className="hidden sm:block" aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
}
