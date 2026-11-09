import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PosHadir — Absensi Lapangan Offline',
  description: 'Absensi QR offline-first untuk operasional lapangan.',
  applicationName: 'PosHadir',
};

export const viewport: Viewport = { themeColor: '#101b26', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
