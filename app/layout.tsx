import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Performance-Critical Data Visualization Dashboard (60 FPS)',
  description:
    'High-performance real-time telemetry dashboard rendering 10,000+ data points smoothly at 60 FPS using Next.js 14 App Router, TypeScript, Canvas and Web Workers.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-slate-100 min-h-screen antialiased selection:bg-sky-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
