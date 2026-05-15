import type { Metadata } from "next";
import "../styles/globals.css";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  metadataBase: new URL("https://yexcel.hackknow.com"),
  title: "YAI-Excel — Give us anything. Get a dashboard.",
  description:
    "Universal AI Excel dashboard generator. Image, video, PDF, Excel, CSV, or plain prompt — out comes a fully interactive, enterprise-grade workbook.",
  keywords: ["Excel", "AI", "Dashboard", "Hackknow", "YAHAVIS", "Neo Brutalism", "Hindi", "Indian"],
  openGraph: {
    title: "YAI-Excel — Give us anything. Get a dashboard.",
    description: "Universal AI Excel dashboard generator by Hackknow.",
    url: "https://yexcel.hackknow.com",
    siteName: "YAI-Excel",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "YAI-Excel" },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='4' y='4' width='56' height='56' fill='%23FFD300' stroke='%230A0A0A' stroke-width='6'/%3E%3Ctext x='32' y='42' text-anchor='middle' font-family='Archivo Black' font-size='30' fill='%230A0A0A'%3EY%3C/text%3E%3C/svg%3E",
  },
};

export const viewport = {
  themeColor: "#FFD300",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body bg-paper text-ink antialiased">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
