import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { InfoHelp } from "@/components/app/InfoHelp";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Pikudo";
const heroTitle = "Pikudo";
const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? "";

export const metadata: Metadata = {
  title: appName,
  description: "Mobile-first web app"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {adsenseClientId ? (
          <Script
            async
            strategy="afterInteractive"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClientId)}`}
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      <body suppressHydrationWarning>
        <div className="container">
          <InfoHelp />
          <main>{children}</main>
          <footer className="footer">
            © {new Date().getFullYear()} {appName}
          </footer>
        </div>
      </body>
    </html>
  );
}
