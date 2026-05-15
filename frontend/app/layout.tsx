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
  icons: { icon: "/icon.svg" },
  manifest: "/manifest.json",
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
