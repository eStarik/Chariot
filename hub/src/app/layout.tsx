import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chariot | Agones Management",
  description: "A lightweight, premium dashboard for Agones game server fleets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="header">
            <h1 className="title-main">Chariot</h1>
            <nav>
              <span className="chariot-status" style={{ color: 'var(--chariot-bronze)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                COORD_PHASE_01 // READY
              </span>
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
