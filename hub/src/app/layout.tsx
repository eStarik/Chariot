'use client';

import type { Metadata } from "next";
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { TelemetryProvider } from "../components/TelemetryContext";
import SessionWrapper from "../components/SessionWrapper";
import "./globals.css";

// Metadata is handled by a separate server-side file in Next.js 13+ App Router
// if the layout is a client component, or we can just omit it here for simplicity.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <body>
        <SessionWrapper>
          <div className="app-container">
            <TelemetryProvider>
              {/* Categorical Sidebar Navigation - Only shown if not on login page */}
              {pathname !== '/login' && (
                <aside>
                  <div className="logo">
                    <Link href="/" style={{ textDecoration: 'none' }}>
                      <h1>CHARIOT</h1>
                    </Link>
                  </div>
                  <nav>
                    <Link href="/" className={pathname === '/' ? 'active' : ''}>Overview</Link>
                    <Link href="/legions" className={pathname === '/legions' ? 'active' : ''}>Legions (Clusters)</Link>
                    <Link href="/formations" className={pathname === '/formations' ? 'active' : ''}>Formations (Deploy)</Link>
                    <Link href="/hoplites" className={pathname === '/hoplites' ? 'active' : ''}>Hoplites (Servers)</Link>
                    <Link href="/logistics" className={pathname === '/logistics' ? 'active' : ''}>Logistics (Settings)</Link>
                  </nav>
                  
                  <div style={{ marginTop: 'auto', padding: '1.5rem', opacity: '0.2', fontSize: '10px', fontWeight: 'bold' }}>
                    AGONES_CHARIOT_V{process.env.NEXT_PUBLIC_DEPLOY_VERSION || '0.3.0'}
                  </div>
                </aside>
              )}

              {/* Primary Main Content Area */}
              <main style={pathname === '/login' ? { marginLeft: 0, width: '100%' } : {}}>
                {children}
              </main>
            </TelemetryProvider>
          </div>
        </SessionWrapper>
      </body>
    </html>
  );
}
