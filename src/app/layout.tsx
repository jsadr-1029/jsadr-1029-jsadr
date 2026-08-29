import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { UserMenu } from "@/components/UserMenu";
import { FetchInterceptorLoader } from "@/components/fetch-interceptor-loader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Jsadr · Jo*** Se*** Al*** D** R**",
  description: "Plataforma bancaria para registro y control de solicitudes, con seguimiento jurídico y notificaciones WhatsApp automáticas.",
  keywords: ["solicitudes", "gestión", "banca", "jurídico", "WhatsApp"],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#1a1530",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <FetchInterceptorLoader />
        {children}
        <Toaster />
        <UserMenu />
      </body>
    </html>
  );
}
