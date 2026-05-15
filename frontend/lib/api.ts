/**
 * Frontend → backend bridge.
 *
 * Deploy modes:
 *  - Same-origin (dev / Docker Compose):  fetches /api/* on the current host.
 *  - Split-subdomain (Cloudflare Pages):  set NEXT_PUBLIC_API_URL to the
 *                                          backend's public URL (e.g.
 *                                          https://api.yexcel.hackknow.com).
 *  - Custom proxy (anywhere):              point NEXT_PUBLIC_API_URL at any
 *                                          reverse-proxy in front of the API.
 */

const BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const url = (path: string) => (BASE ? `${BASE}${path}` : path);

export type UploadResult = {
  token: string;
  type: string;
  summary: string;
  file?: string | null;
  url?: string | null;
  text_preview?: string;
};

export type GenerateResult = {
  token: string;
  type: string;
  theme: string;
  download_url: string;
  filename: string;
  audit: {
    domain?: string;
    counts?: Record<string, number>;
    confidence?: number;
    enhancement_suggestions?: { description: string; priority: string }[];
  };
};

export async function upload(form: FormData): Promise<UploadResult> {
  const r = await fetch(url("/api/upload"), { method: "POST", body: form });
  if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
  return r.json();
}

export async function generate(
  token: string,
  theme: string,
  mode: string = "enhance",
  user_prompt?: string,
): Promise<GenerateResult> {
  const r = await fetch(url("/api/generate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, theme, mode, user_prompt }),
  });
  if (!r.ok) throw new Error(`Generate failed: ${r.status}`);
  const data = (await r.json()) as GenerateResult;
  // Make download_url absolute when we're on a split-subdomain deploy.
  if (BASE && data.download_url && data.download_url.startsWith("/")) {
    data.download_url = `${BASE}${data.download_url}`;
  }
  return data;
}

export async function fetchThemes(): Promise<string[]> {
  try {
    const r = await fetch(url("/api/themes"));
    const data = await r.json();
    return data.themes || [];
  } catch {
    return [
      "midnight", "emerald", "crimson", "slate", "amber",
      "ocean", "violet", "rose", "carbon", "arctic",
    ];
  }
}
