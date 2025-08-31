import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tetris Online',
  description: 'Play Tetris online with friends',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
