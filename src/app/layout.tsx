import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScribaAI · Transcripció i actes de reunió amb IA",
  description:
    "Grava la reunió, transcriu-la i genera l'acta estructurada automàticament.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ca">
      <body>{children}</body>
    </html>
  );
}
