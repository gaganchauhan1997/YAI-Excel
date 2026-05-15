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
  const r = await fetch("/api/upload", { method: "POST", body: form });
  if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
  return r.json();
}

export async function generate(
  token: string,
  theme: string,
  mode: string = "enhance",
  user_prompt?: string,
): Promise<GenerateResult> {
  const r = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, theme, mode, user_prompt }),
  });
  if (!r.ok) throw new Error(`Generate failed: ${r.status}`);
  return r.json();
}

export async function fetchThemes(): Promise<string[]> {
  try {
    const r = await fetch("/api/themes");
    const data = await r.json();
    return data.themes || [];
  } catch {
    return ["midnight", "emerald", "crimson", "slate", "amber", "ocean", "violet", "rose", "carbon", "arctic"];
  }
}
