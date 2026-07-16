import type { Metadata } from 'next'

import { CanvasConnectForm } from './connect/CanvasConnectForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Connect Canvas' }

export default function HomePage() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:py-12">
      <CanvasConnectForm />
    </main>
  )
}
