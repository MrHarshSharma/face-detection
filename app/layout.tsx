import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Facial Detection Application',
  description: 'Facial Detection Application made with love by Harsh sharma',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.png" />
        {/* Other head elements */}
      </head>
      <body>{children}</body>
    </html>
  )
}
