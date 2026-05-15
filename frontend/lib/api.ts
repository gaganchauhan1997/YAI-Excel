/**
 * YAI-Excel Frontend → Backend API Bridge v3.0
 * Pure XLSX output with embedded charts (no HTML).
 * Supports Groq + Gemini user-provided keys.
 * Optional dashboard image reference (Gemini Vision extracts layout).
 */

const BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const url = (path: string) => (BASE ? `${BASE}${path}` : path);

export function absUrl(relUrl: string): string {
  if (!relUrl) return "";
  if (relUrl.startsWith("http")) return relUrl;
  return BASE ? `${BASE}${relUrl}` : relUrl;
}

export type ApiKeys = {
  groq?: string;
  gemini?: string;
};

export type UploadResult = {
  token: string;
  type: string;
  summary: string;
  has_image?: boolean;
  analysis?: {
    domain?: string;
    kpi_count?: number;
    chart_count?: number;
  };
};

export type GenerateResult = {
  token: string;
  theme: string;
  download_url: string;
  filename: string;
  spec?: {
    title?: string;
    domain?: string;
    kpi_count?: number;
    chart_count?: number;
  };
  audit?: {
    domain?: string;
    confidence?: number;
    enhancement_suggestions?: { description: string; priority: string }[];
  };
};

export async function upload(form: FormData, keys?: ApiKeys): Promise<UploadResult> {
  if (keys?.groq) form.append("groq_api_key", keys.groq);
  if (keys?.gemini) form.append("gemini_api_key", keys.gemini);
  const r = await fetch(url("/api/upload"), { method: "POST", body: form });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(err.error || `Upload failed: ${r.status}`);
  }
  return r.json();
}

export async function generate(
  token: string,
  theme: string,
  mode: string = "enhance",
  user_prompt?: string,
  keys?: ApiKeys,
): Promise<GenerateResult> {
  const r = await fetch(url("/api/generate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      theme,
      mode,
      user_prompt,
      groq_api_key: keys?.groq || "",
      gemini_api_key: keys?.gemini || "",
    }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(err.error || `Generate failed: ${r.status}`);
  }
  const data = (await r.json()) as GenerateResult;
  if (data.download_url?.startsWith("/")) data.download_url = absUrl(data.download_url);
  return data;
}

export async function fetchThemes(): Promise<string[]> {
  try {
    const r = await fetch(url("/api/themes"));
    const data = await r.json();
    return data.themes || [];
  } catch {
    return ["midnight", "emerald", "crimson", "slate", "amber", "ocean", "violet", "rose", "carbon", "arctic"];
  }
}
