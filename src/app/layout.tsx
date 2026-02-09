import "./globals.css";
import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";

const headingFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap"
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

export const metadata: Metadata = {
  title: "RAG Industries Ops",
  description: "Manufacturing operations prototype for RAG Industries"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
