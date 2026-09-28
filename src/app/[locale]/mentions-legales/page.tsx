import { LegalPage, legalLocale, legalMetadata } from "../_legal/legal-route";

/** The legal notice in French. /en/mentions-legales redirects to /en/legal-notice. */
const locale = legalLocale("mentions-legales");

export function generateMetadata() {
  return legalMetadata(locale);
}

export default function LegalNoticePage() {
  return <LegalPage locale={locale} />;
}
