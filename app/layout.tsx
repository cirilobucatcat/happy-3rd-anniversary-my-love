import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Happy 3rd Year, My Love",
  description: "A little something, made for you.",
  // A private gift: keep it out of search engines. `public/_headers` sends the same instruction for every file.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f9a8c6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-locked="true">
      <body>{children}</body>
    </html>
  );
}
