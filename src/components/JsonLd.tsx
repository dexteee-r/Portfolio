import { serializeJsonLd, type JsonLd as JsonLdData } from "@/seo/structured-data";

/** Structured data for search engines, rendered on the server. */
export function JsonLd({ data }: { data: JsonLdData }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
