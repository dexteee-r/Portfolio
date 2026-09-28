import { legalCard, legalCardMetadata } from "../_legal/legal-card";
import { legalLocale } from "../_legal/legal-route";

export const contentType = "image/png";

const locale = legalLocale("mentions-legales");

export function generateImageMetadata() {
  return legalCardMetadata(locale);
}

export default function LegalShareCard() {
  return legalCard(locale);
}
