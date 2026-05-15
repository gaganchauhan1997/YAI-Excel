import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "YAI-Excel — Give us anything. Get a dashboard.",
  description:
    "Universal AI Excel dashboard generator. Image, video, PDF, Excel, CSV, or plain prompt — out comes a fully interactive, enterprise-grade workbook.",
  keywords: ["Excel", "AI", "Dashboard", "Generator", "YAI", "Hackknow", "Free Tier"],
  authors: [{ name: "Gagan Chauhan (Hackknow)" }],
  openGraph: {
    title: "YAI-Excel",
    description: "Give us anything. Get a dashboard.",
    url: "https://github.com/gaganchauhan1997/YAI-Excel",
    siteName: "YAI-Excel",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body bg-bg text-text antialiased">{children}</body>
    </html>
  );
}
