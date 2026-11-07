import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Bundled with the site (app/fonts); no request to any font service.
const handwriting = localFont({
  src: "./fonts/caveat-latin.woff2",
  variable: "--font-hand",
  weight: "400 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Happy 3rd Year, My Love",
  description: "A little something, made for you.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f9a8c6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={handwriting.variable}>
      <body>{children}</body>
    </html>
  );
}
