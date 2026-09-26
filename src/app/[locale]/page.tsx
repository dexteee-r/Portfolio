import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Desk } from "@/components/Desk";
import { JsonLd } from "@/components/JsonLd";
import { countByChapter, loadProjects } from "@/content/projects";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { homePath } from "@/i18n/paths";
import { pageMetadata } from "@/seo/metadata";
import { graph, personLd, websiteLd } from "@/seo/structured-data";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);
  return pageMetadata({
    locale,
    pathFor: homePath,
    absoluteTitle: dict.meta.title,
    description: dict.meta.description,
  });
}

export default async function DeskPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);

  return (
    <>
      <JsonLd data={graph(websiteLd(), personLd(dict.meta.jobTitle))} />
      <Desk locale={locale} dict={dict} counts={countByChapter(loadProjects())} />
    </>
  );
}
