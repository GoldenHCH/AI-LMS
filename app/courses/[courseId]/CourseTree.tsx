import { useState } from 'react'

import type { CourseItem, CourseModule, ItemKind } from '@/lib/courses/getCourseTree'

type CourseTreeProps = {
  modules: CourseModule[]
  selectedItemId: string | null
  onSelect: (item: CourseItem) => void
}

export function CourseTree({ modules, selectedItemId, onSelect }: CourseTreeProps) {
  const [expanded, setExpanded] = useState(() => new Set(modules.map((module) => module.id)))

  function toggleModule(moduleId: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(moduleId)) {
        next.delete(moduleId)
      } else {
        next.add(moduleId)
      }
      return next
    })
  }

  if (!modules.length) {
    return <p className="px-5 py-8 text-sm leading-6 text-slate-600">No modules were imported.</p>
  }

  return (
    <div className="max-h-[calc(100vh-17rem)] overflow-y-auto px-3 py-3">
      {modules.map((module, moduleIndex) => {
        const isExpanded = expanded.has(module.id)
        const regionId = `module-items-${module.id}`

        return (
          <section key={module.id} className="border-b border-slate-100 py-2 last:border-b-0">
            <button
              type="button"
              onClick={() => toggleModule(module.id)}
              aria-expanded={isExpanded}
              aria-controls={regionId}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ocean"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-xs font-semibold text-white" aria-hidden="true">
                {moduleIndex + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{module.name}</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {module.items.length} {module.items.length === 1 ? 'item' : 'items'}
                </span>
              </span>
              <ChevronIcon expanded={isExpanded} />
            </button>

            {isExpanded ? (
              <ul id={regionId} className="mt-1 space-y-1 pb-2 pl-3">
                {module.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      aria-pressed={selectedItemId === item.id}
                      className={`group flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ocean ${
                        selectedItemId === item.id
                          ? 'border-ocean/30 bg-ocean/10 text-ocean'
                          : isReadOnly(item.kind)
                            ? 'border-transparent bg-slate-50 text-slate-600 hover:border-slate-200'
                            : 'border-transparent text-slate-700 hover:border-ocean/15 hover:bg-ocean/5'
                      }`}
                    >
                      <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconStyle(item.kind)}`}>
                        <KindIcon kind={item.kind} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            {kindLabel(item.kind)}
                          </span>
                          {isReadOnly(item.kind) ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[0.65rem] font-semibold text-slate-700">
                              <LockIcon /> Read-only
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}

function isReadOnly(kind: ItemKind) {
  return kind === 'file' || kind === 'opaque'
}

function kindLabel(kind: ItemKind) {
  if (kind === 'opaque') return 'Unsupported'
  return kind
}

function iconStyle(kind: ItemKind) {
  if (kind === 'page') return 'bg-sky-100 text-sky-700'
  if (kind === 'quiz') return 'bg-amber-100 text-amber-800'
  return 'bg-slate-200 text-slate-600'
}

function KindIcon({ kind }: { kind: ItemKind }) {
  if (kind === 'quiz') {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
        <path d="M6 3.5h8A1.5 1.5 0 0 1 15.5 5v10A1.5 1.5 0 0 1 14 16.5H6A1.5 1.5 0 0 1 4.5 15V5A1.5 1.5 0 0 1 6 3.5Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7.5 8h5M7.5 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'file') {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
        <path d="M5 3.5h6l4 4V16a1 1 0 0 1-1 1H5.8A.8.8 0 0 1 5 16.2V3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M11 3.5V8h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    )
  }
  if (kind === 'opaque') {
    return (
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
        <path d="M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8.5 8a1.6 1.6 0 1 1 2.35 1.42c-.55.3-.85.62-.85 1.33M10 13.8v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M5 3.5h10v13H5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.5 7h5M7.5 10h5M7.5 13h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} fill="none" aria-hidden="true">
      <path d="m6.5 8 3.5 3.5L13.5 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden="true">
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 7V5.3a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}
