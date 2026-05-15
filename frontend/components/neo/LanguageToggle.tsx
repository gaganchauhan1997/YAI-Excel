"use client";

import { useI18n } from "@/lib/i18n";
import NeoPill from "./NeoPill";

export default function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <button
      onClick={() => setLocale(locale === "en" ? "hi" : "en")}
      className="cursor-pointer"
      aria-label="Toggle language"
    >
      <NeoPill variant={locale === "hi" ? "primary" : "snow"}>
        {locale === "en" ? "EN · हिं" : "हिं · EN"}
      </NeoPill>
    </button>
  );
}
