import Link from "next/link";

export const metadata = { title: "404 · YAI-Excel" };

export default function NotFound() {
  return (
    <main className="min-h-screen bg-paper flex items-center justify-center px-4 py-16">
      <div className="text-center max-w-md">
        <div className="inline-block bg-primary border-[3px] border-ink px-4 py-1 shadow-neo-sm font-mono text-sm mb-6">
          ERROR · 404
        </div>
        <h1 className="font-display text-6xl sm:text-8xl leading-none">LOST.</h1>
        <p className="text-ink/70 mt-4 mb-8">
          That URL doesn't exist on YAI-Excel. Probably never did.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-snow border-[3px] border-ink shadow-neo font-bold hover:translate-x-[-1px] hover:translate-y-[-1px] transition"
        >
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
