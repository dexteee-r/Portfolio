import { LegalPage, legalLocale, legalMetadata } from "../_legal/legal-route";

/** The legal notice in English. /fr/legal-notice redirects to /fr/mentions-legales. */
const locale = legalLocale("legal-notice");

export function generateMetadata() {
  return legalMetadata(locale);
}

export default function LegalNoticePage() {
  return <LegalPage locale={locale} />;
}
