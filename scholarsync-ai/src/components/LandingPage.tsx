/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {ArrowRight, Circle, ClipboardCheck, Eye, Gavel, GraduationCap, Mail} from 'lucide-react';
import {motion} from 'motion/react';
import {DEMO_REQUEST_URL} from '../config';

const mockupImageUrl = '/images/course-diff-mockup.jpg';

export default function LandingPage() {
  // Common animation configurations
  const fadeInUp = {
    initial: {opacity: 0, y: 30},
    animate: {opacity: 1, y: 0},
    transition: {duration: 0.6, ease: 'easeOut'},
  };

  const staggerContainer = {
    initial: {opacity: 0},
    animate: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  return (
    <div className="bg-paper text-ink overflow-x-hidden">
      {/* 1. Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 grid md:grid-cols-2 gap-12 items-center">
        <motion.div
          className="flex flex-col gap-6"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          {/* Issue Meta Data in high-end Swiss Style */}
          <motion.div
            className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-ink/50"
            variants={fadeInUp}
          >
            <span>Nº 42</span>
            <span>•</span>
            <span>ACADEMIC EDITION</span>
            <span>•</span>
            <span>02 : 26</span>
          </motion.div>

          {/* Featured Tag */}
          <motion.div variants={fadeInUp}>
            <span className="inline-block px-3 py-1 border border-ink rounded-full text-[10px] uppercase font-bold tracking-widest text-ink">
              AI-Native Canvas Co-Pilot
            </span>
          </motion.div>

          {/* Massive Display Title */}
          <motion.h1
            className="font-serif text-5xl sm:text-6xl lg:text-[76px] font-extrabold leading-[0.9] text-ink tracking-tight"
            variants={fadeInUp}
          >
            <span>AI-NATIVE CANVAS</span>
            <span className="italic font-normal block pl-12 sm:pl-20 text-accent font-serif my-1">Course Updates</span>
            <span className="block">IN HOURS.</span>
          </motion.h1>

          <motion.p
            className="font-serif text-lg sm:text-xl text-ink/80 italic leading-relaxed max-w-xl"
            variants={fadeInUp}
          >
            Tell ScholarSync AI what you want changed in your Canvas pages and quizzes, review every
            edit as a clear side-by-side diff, and export your approved changes as a brand-new Canvas
            course.
          </motion.p>

          <motion.div className="pt-4 flex flex-col sm:flex-row gap-4" variants={fadeInUp}>
            <a
              href={DEMO_REQUEST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-accent text-paper border border-accent hover:bg-transparent hover:text-accent outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent px-8 py-3.5 rounded text-xs font-bold uppercase tracking-widest transition-all shadow-none inline-flex items-center justify-center gap-2 cursor-pointer"
              id="hero-btn-demo"
            >
              <span>
                Request a Demo<span className="sr-only"> (opens in a new tab)</span>
              </span>
              <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
            </a>
            <a
              href="#platform"
              className="border border-editorial-line hover:bg-ink hover:text-paper text-ink outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent px-8 py-3.5 rounded text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
              id="hero-btn-explore"
            >
              <span>Explore Platform</span>
            </a>
          </motion.div>
        </motion.div>

        <motion.a
          href={DEMO_REQUEST_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="relative rounded overflow-hidden border border-editorial-line bg-paper group block p-2 cursor-pointer outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          initial={{opacity: 0, x: 50}}
          animate={{opacity: 1, x: 0}}
          transition={{duration: 0.8, ease: 'easeOut'}}
        >
          <div className="absolute inset-0 bg-ink/5 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-300 z-10 pointer-events-none flex items-center justify-center">
            <span className="bg-paper text-ink border border-editorial-line px-5 py-2.5 rounded font-bold shadow-none flex items-center gap-2 text-xs uppercase tracking-wider scale-95 group-hover:scale-100 group-focus-visible:scale-100 transition-transform duration-300">
              <Mail size={16} strokeWidth={2} aria-hidden="true" />
              Request a Demo
            </span>
          </div>
          <img
            alt="Screenshot of the ScholarSync AI review screen, showing a Canvas page's original content next to the proposed edit."
            className="w-full h-auto object-cover rounded transform scale-100 group-hover:scale-[1.01] transition-transform duration-500"
            src={mockupImageUrl}
            width={512}
            height={286}
          />
        </motion.a>
      </section>

      {/* 2. Trust / Built for Professors Section */}
      <section className="bg-paper border-y border-editorial-line py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-ink mb-16 max-w-3xl mx-auto tracking-tight"
            initial={{opacity: 0}}
            whileInView={{opacity: 1}}
            viewport={{once: true}}
            transition={{duration: 0.6}}
          >
            Built for professors who want AI speed without giving up control.
          </motion.h2>

          <motion.div
            className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-editorial-line border-y border-editorial-line py-8"
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{once: true}}
          >
            {/* Feature 1 */}
            <motion.div
              className="p-8 flex flex-col items-center text-center transition-all duration-300 group hover:bg-ink/5"
              variants={fadeInUp}
              id="trust-card-1"
            >
              <div className="w-14 h-14 rounded-full border border-editorial-line group-hover:bg-accent group-hover:border-accent flex items-center justify-center mb-6 transition-colors duration-300">
                <Eye
                  className="text-ink group-hover:text-paper transition-colors duration-300"
                  size={24}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </div>
              <h3 className="text-base uppercase tracking-wider font-extrabold text-ink mb-3">Reviewable Edits</h3>
              <p className="text-ink/70 text-sm leading-relaxed max-w-xs font-serif italic">
                See exactly what changes before it goes live. No accidental overrides, ever.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              className="p-8 flex flex-col items-center text-center transition-all duration-300 group hover:bg-ink/5"
              variants={fadeInUp}
              id="trust-card-2"
            >
              <div className="w-14 h-14 rounded-full border border-editorial-line group-hover:bg-accent group-hover:border-accent flex items-center justify-center mb-6 transition-colors duration-300">
                <Gavel
                  className="text-ink group-hover:text-paper transition-colors duration-300"
                  size={24}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </div>
              <h3 className="text-base uppercase tracking-wider font-extrabold text-ink mb-3">Absolute Approval</h3>
              <p className="text-ink/70 text-sm leading-relaxed max-w-xs font-serif italic">
                You remain in the driver's seat. Accept, edit, or reject any proposal instantly.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              className="p-8 flex flex-col items-center text-center transition-all duration-300 group hover:bg-ink/5"
              variants={fadeInUp}
              id="trust-card-3"
            >
              <div className="w-14 h-14 rounded-full border border-editorial-line group-hover:bg-accent group-hover:border-accent flex items-center justify-center mb-6 transition-colors duration-300">
                <ClipboardCheck
                  className="text-ink group-hover:text-paper transition-colors duration-300"
                  size={24}
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </div>
              <h3 className="text-base uppercase tracking-wider font-extrabold text-ink mb-3">Secondary Validation</h3>
              <p className="text-ink/70 text-sm leading-relaxed max-w-xs font-serif italic">
                Any change to a quiz's correct answers, points, or question count is explicitly flagged
                before you approve it.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 3. How It Works Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24" id="platform">
        <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-ink text-center mb-20 tracking-tight">
          How It Works
        </h2>

        <div className="grid md:grid-cols-3 gap-12 relative">
          {/* Timeline Connector Line */}
          <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-[1px] bg-editorial-line -z-10"></div>

          {/* Step 1 */}
          <div className="flex flex-col items-center text-center group">
            <div className="w-20 h-20 bg-ink text-paper flex items-center justify-center text-2xl font-serif font-bold mb-6 border border-editorial-line group-hover:bg-accent transition-colors duration-300">
              1
            </div>
            <h3 className="text-xs uppercase tracking-widest font-extrabold text-ink mb-3">Canvas Import</h3>
            <p className="text-ink/70 text-sm font-serif italic leading-relaxed max-w-xs">
              Connect your Canvas course and choose the pages and quizzes you want to update.
            </p>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center group">
            <div className="w-20 h-20 bg-ink text-paper flex items-center justify-center text-2xl font-serif font-bold mb-6 border border-editorial-line group-hover:bg-accent transition-colors duration-300">
              2
            </div>
            <h3 className="text-xs uppercase tracking-widest font-extrabold text-ink mb-3">Instruction</h3>
            <p className="text-ink/70 text-sm font-serif italic leading-relaxed max-w-xs">
              Provide simple, natural guidelines of what needs changing in plain language.
            </p>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center group">
            <div className="w-20 h-20 bg-ink text-paper flex items-center justify-center text-2xl font-serif font-bold mb-6 border border-editorial-line group-hover:bg-accent transition-colors duration-300">
              3
            </div>
            <h3 className="text-xs uppercase tracking-widest font-extrabold text-ink mb-3">Visual Diff Review</h3>
            <p className="text-ink/70 text-sm font-serif italic leading-relaxed max-w-xs">
              Check a side-by-side diff highlighting deletions in red and additions in green, then
              export your approved changes as a new Canvas course.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Feature Details / Precision Editing at Scale */}
      <section className="bg-paper py-16 md:py-24 border-y border-editorial-line" id="solutions">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-ink mb-8 tracking-tight">
                Precision Editing at Scale
              </h2>

              <ul className="space-y-8">
                {/* Check 1 */}
                <li className="flex gap-4">
                  <Circle className="text-accent mt-0.5 shrink-0" size={24} strokeWidth={2} aria-hidden="true" />
                  <div>
                    <h4 className="text-xs uppercase tracking-widest font-extrabold text-ink mb-1">Course-Wide Updates</h4>
                    <p className="text-ink/75 text-sm font-serif italic leading-relaxed">
                      Apply consistent policy changes across every page and quiz in your course with a
                      single prompt.
                    </p>
                  </div>
                </li>

                {/* Check 2 */}
                <li className="flex gap-4">
                  <Circle className="text-accent mt-0.5 shrink-0" size={24} strokeWidth={2} aria-hidden="true" />
                  <div>
                    <h4 className="text-xs uppercase tracking-widest font-extrabold text-ink mb-1">Side-by-Side Review</h4>
                    <p className="text-ink/75 text-sm font-serif italic leading-relaxed">
                      Our interactive diff view guarantees you see and control every textual
                      modification before it's ever exported.
                    </p>
                  </div>
                </li>

                {/* Check 3 */}
                <li className="flex gap-4">
                  <Circle className="text-accent mt-0.5 shrink-0" size={24} strokeWidth={2} aria-hidden="true" />
                  <div>
                    <h4 className="text-xs uppercase tracking-widest font-extrabold text-ink mb-1">Pages & Quizzes</h4>
                    <p className="text-ink/75 text-sm font-serif italic leading-relaxed">
                      Update instructional pages and quiz questions — including answer keys and point
                      values, always flagged for review — without touching anything else in your course.
                    </p>
                  </div>
                </li>

                {/* Check 4 */}
                <li className="flex gap-4">
                  <Circle className="text-accent mt-0.5 shrink-0" size={24} strokeWidth={2} aria-hidden="true" />
                  <div>
                    <h4 className="text-xs uppercase tracking-widest font-extrabold text-ink mb-1">Formatting Preservation</h4>
                    <p className="text-ink/75 text-sm font-serif italic leading-relaxed">
                      ScholarSync AI preserves your original HTML structure, internal links, and
                      formatting — only the parts you approve ever change.
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="rounded border border-editorial-line bg-paper p-4">
              <img
                alt="The ScholarSync AI diff review interface highlighting accepted and pending course edits."
                className="w-full h-auto object-cover rounded border border-editorial-line"
                src={mockupImageUrl}
                width={512}
                height={286}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 5. Final CTA Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-bold text-ink mb-8 max-w-4xl mx-auto leading-tight tracking-tight">
          Spend less time editing Canvas—and more time teaching.
        </h2>
        <p className="font-serif text-lg text-ink/75 italic max-w-2xl mx-auto mb-10">
          Get a private workspace and see AI-powered Canvas course editing today.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <a
            href={DEMO_REQUEST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-accent text-paper border border-accent hover:bg-transparent hover:text-accent outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent px-10 py-4 rounded text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shadow-none inline-flex items-center justify-center gap-2"
            id="cta-btn-demo"
          >
            <span>
              Request a Demo<span className="sr-only"> (opens in a new tab)</span>
            </span>
            <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
          </a>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="bg-paper border-t border-editorial-line py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <GraduationCap className="text-accent" size={24} strokeWidth={2} aria-hidden="true" />
              <span className="font-serif text-xl font-bold text-ink">ScholarSync AI</span>
            </div>
            <p className="text-xs text-ink/60 max-w-sm">
              © 2026 ScholarSync AI. All rights reserved. An AI-native course editor for Canvas.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs font-bold uppercase tracking-widest text-ink/70">
            <a
              href="#platform"
              className="outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent hover:text-accent transition-colors rounded"
            >
              Platform
            </a>
            <a
              href="#solutions"
              className="outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent hover:text-accent transition-colors rounded"
            >
              Solutions
            </a>
            <a
              href={DEMO_REQUEST_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent hover:text-accent transition-colors rounded"
            >
              Request a Demo<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
