import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat, Italianno } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const italiano = Italianno({
  variable: "--font-italiano",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Jiko",
  description: "No more excuses. Jiko holds you accountable.",
  keywords: [],
  viewport: "width=device-width, initial-scale=1.0",
  authors: [{name: "Hadi Ahmad"}]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${montserrat.variable} ${italiano.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
