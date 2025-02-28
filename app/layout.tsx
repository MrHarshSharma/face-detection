import type { Metadata } from 'next'
import './globals.css'
import Navbar from "@/components/Navbar"

export const metadata: Metadata = {
  title: 'Facial Detection Application',
  description: 'Facial Detection Application made with love by Harsh sharma',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.png" />
        {/* Other head elements */}
      </head>
      <body suppressHydrationWarning>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
