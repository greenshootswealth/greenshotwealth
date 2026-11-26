import React from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReportView from "@/components/research/ReportView";
import { getPublishedReportBySlug, getPublishedReports } from "@/lib/research/server";

const SITE_URL = "https://greenshootswealth.com";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Reports published after the build are rendered on first visit, then cached.
export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const reports = await getPublishedReports();
    return reports.map((p) => ({ slug: p.slug }));
  } catch (error) {
    // A build without database access still succeeds; pages render on demand.
    console.error("Research generateStaticParams failed:", error);
    return [];
  }
}

const absolute = (url: string) => (/^https?:\/\//.test(url) ? url : `${SITE_URL}${url}`);

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pub = await getPublishedReportBySlug(slug);

  if (!pub) {
    return { title: "Research Report Not Found | Green Shoots Wealth" };
  }

  const pageUrl = `${SITE_URL}/insights/research/${pub.slug}`;
  const ogImageUrl = absolute(pub.coverImage);
  const metaTitle = pub.seo.metaTitle || pub.title;
  const description = pub.seo.metaDescription || pub.subtitle;

  return {
    title: `${pub.title} | Green Shoots Wealth Research`,
    description,
    keywords: pub.seo.keywords,
    alternates: { canonical: pageUrl },
    openGraph: {
      title: metaTitle,
      description,
      url: pageUrl,
      siteName: "Green Shoots Wealth",
      type: "article",
      publishedTime: pub.publishedIso,
      modifiedTime: pub.updatedIso,
      authors: ["Green Shoots Wealth Research"],
      images: [{ url: ogImageUrl, alt: pub.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function PublicationDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const [pub, all] = await Promise.all([getPublishedReportBySlug(slug), getPublishedReports()]);

  if (!pub) {
    notFound();
  }

  const otherPublications = all.filter((p) => p.slug !== pub.slug).slice(0, 3);
  const pageUrl = `${SITE_URL}/insights/research/${pub.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Report",
        "@id": `${pageUrl}#report`,
        isPartOf: {
          "@type": "WebSite",
          "@id": `${SITE_URL}/#website`,
          name: "Green Shoots Wealth",
          url: SITE_URL,
        },
        headline: pub.title,
        alternativeHeadline: pub.subtitle,
        description: pub.seo.metaDescription || pub.subtitle,
        datePublished: pub.publishedIso,
        dateModified: pub.updatedIso,
        inLanguage: "en-IN",
        author: {
          "@type": "Organization",
          name: "Green Shoots Wealth Research",
          url: SITE_URL,
          logo: `${SITE_URL}/icon.png`,
        },
        publisher: {
          "@type": "Organization",
          name: "Green Shoots Wealth Fintech LLP",
          url: SITE_URL,
          logo: `${SITE_URL}/icon.png`,
        },
        image: absolute(pub.coverImage),
        mainEntityOfPage: pageUrl,
        encodingFormat: "application/pdf",
        url: absolute(pub.pdfUrl),
        keywords: pub.seo.keywords.join(", "),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Insights", item: `${SITE_URL}/insights` },
          {
            "@type": "ListItem",
            position: 3,
            name: "Research & Reports",
            item: `${SITE_URL}/insights?tab=research`,
          },
          { "@type": "ListItem", position: 4, name: pub.title, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ReportView pub={pub} otherPublications={otherPublications} totalReports={all.length} />
    </>
  );
}
