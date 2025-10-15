import type { Metadata } from "next";
import { Geist, Geist_Mono, Montserrat, Italianno } from "next/font/google";
import "./globals.css";
import LotusFlower from "@/components/LotusFlower";
import Navbar from "@/components/Navbar";
import CursorHandler from "@/components/CursorHandler";

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
  openGraph: {
    title: "Jiko",
    description: "No more excuses. Jiko holds you accountable.",
    url: "https://jiko.life",
    siteName: "Jiko",
    images: [
      {
        url: "images/metadata/og-image.png",
        width: 3438,
        height: 2056,
        alt: "Jiko — No more excuses."
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Jiko",
    description: "No more excuses. Jiko holds you accountable.",
    creator: "@hadiahmad06",
    site: "@hadiahmad06",
    images: ["images/metadata/og-image.png"]
  },
  metadataBase: new URL("https://jiko.life"),
  icons: {
    icon: "images/metadata/favicon.ico",
    apple: "images/metadata/apple-touch-icon.png",
    shortcut: "images/metadata/favicon-32x32.png"
  },
  alternates: {
    canonical: "https://jiko.life"
  }
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
          <CursorHandler>
            {children}
           </CursorHandler>
          <LotusFlower />
          <div className="h-24"/>
         </div>
      </body>
    </html>
  );
}
