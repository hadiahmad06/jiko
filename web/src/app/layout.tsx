import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat, Italianno } from "next/font/google";
import "./globals.css";
import LotusFlower from "@/components/LotusFlower";
import Navbar from "@/components/Navbar";

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
  // viewport: "width=device-width, initial-scale=1.0",
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
        <div className="text-foreground min-h-screen font-sans flex flex-col justify-between">
          <Navbar />
          <div className="h-8"/>
          {children}
          <LotusFlower />
          <div className="h-24"/>
         </div>
      </body>
    </html>
  );
}
