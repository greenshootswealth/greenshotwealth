import React from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  PUBLICATIONS,
  getPublicationBySlug,
  type Publication,
} from "@/lib/publications";
import { ArrowRightIcon } from "@/components/Icons";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return PUBLICATIONS.map((p) => ({
    slug: p.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pub = getPublicationBySlug(slug);

  if (!pub) {
    return {
      title: "Research Report Not Found | Green Shoots Wealth",
    };
  }

  const siteUrl = "https://greenshootswealth.com";
  const pageUrl = `${siteUrl}/insights/research/${pub.slug}`;
  const ogImageUrl = `${siteUrl}${pub.coverImage}`;

  return {
    title: `${pub.title} | Green Shoots Wealth Research`,
    description: pub.seo.metaDescription,
    keywords: pub.seo.keywords,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: pub.seo.metaTitle,
      description: pub.seo.metaDescription,
      url: pageUrl,
      siteName: "Green Shoots Wealth",
      type: "article",
      publishedTime: pub.publishedIso,
      authors: ["Green Shoots Wealth Research"],
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: pub.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: pub.seo.metaTitle,
      description: pub.seo.metaDescription,
      images: [ogImageUrl],
    },
  };
}

export default async function PublicationDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const pub = getPublicationBySlug(slug);

  if (!pub) {
    notFound();
  }

  const otherPublications = PUBLICATIONS.filter((p) => p.slug !== pub.slug).slice(
    0,
    3
  );

  const siteUrl = "https://greenshootswealth.com";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Report",
        "@id": `${siteUrl}/insights/research/${pub.slug}#report`,
        "isPartOf": {
          "@type": "WebSite",
          "@id": `${siteUrl}/#website`,
          "name": "Green Shoots Wealth",
          "url": siteUrl,
        },
        "headline": pub.title,
        "alternativeHeadline": pub.subtitle,
        "description": pub.seo.metaDescription,
        "datePublished": pub.publishedIso,
        "dateModified": pub.publishedIso,
        "inLanguage": "en-IN",
        "author": {
          "@type": "Organization",
          "name": "Green Shoots Wealth Research",
          "url": siteUrl,
          "logo": `${siteUrl}/icon.png`,
        },
        "publisher": {
          "@type": "Organization",
          "name": "Green Shoots Wealth Fintech LLP",
          "url": siteUrl,
          "logo": `${siteUrl}/icon.png`,
        },
        "image": `${siteUrl}${pub.coverImage}`,
        "mainEntityOfPage": `${siteUrl}/insights/research/${pub.slug}`,
        "encodingFormat": "application/pdf",
        "url": `${siteUrl}${pub.pdfUrl}`,
        "keywords": pub.seo.keywords.join(", "),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl}/insights/research/${pub.slug}#breadcrumb`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": siteUrl,
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Insights",
            "item": `${siteUrl}/insights`,
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": "Research & Reports",
            "item": `${siteUrl}/insights?tab=research`,
          },
          {
            "@type": "ListItem",
            "position": 4,
            "name": pub.title,
            "item": `${siteUrl}/insights/research/${pub.slug}`,
          },
        ],
      },
    ],
  };

  return (
    <div className="w-full bg-[#F5F1E8] min-h-screen text-[#1F3A2C]">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 1. HERO HEADER */}
      <section className="w-full pt-10 sm:pt-14 pb-12 border-b border-[#e8e2d4]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#5d7064] font-sans mb-6 flex-wrap">
            <Link href="/" className="hover:text-[#1F3A2C] transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link href="/insights" className="hover:text-[#1F3A2C] transition-colors">
              Insights
            </Link>
            <span>/</span>
            <Link href="/insights?tab=research" className="hover:text-[#1F3A2C] transition-colors">
              Research & Reports
            </Link>
            <span>/</span>
            <span className="text-[#1F3A2C] font-semibold truncate max-w-xs sm:max-w-md">
              {pub.category}
            </span>
          </nav>

          {/* Series & Issue Pills */}
          <div className="flex flex-wrap items-center gap-2.5 mb-4">
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#8fa868] bg-[#EEF0D9] px-3.5 py-1 rounded-full font-sans">
              {pub.series}
            </span>
            <span className="text-[11px] font-medium tracking-wide uppercase text-[#968254] bg-[#f2ecdc] px-3 py-1 rounded-full font-sans">
              {pub.issueDate}
            </span>
            <span className="text-[11px] font-medium text-[#5d7064] bg-white border border-[#e8e2d4] px-2.5 py-1 rounded-full font-sans">
              📄 {pub.pageCount} Pages ({pub.fileSize})
            </span>
            <span className="text-[11px] font-medium text-[#5d7064] bg-white border border-[#e8e2d4] px-2.5 py-1 rounded-full font-sans">
              ⏱ {pub.readTime}
            </span>
          </div>

          {/* Main Title & Subtitle */}
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-[48px] text-[#1F3A2C] font-normal leading-[1.15] tracking-tight">
            {pub.title}
          </h1>
          <p className="text-base sm:text-lg text-[#526658] font-sans leading-relaxed mt-4 max-w-3xl">
            {pub.subtitle}
          </p>

          {/* Action Bar (Download & Actions) */}
          <div className="mt-8 flex flex-wrap items-center gap-4 pt-4 border-t border-[#e8e2d4]/80">
            <a
              href={pub.pdfUrl}
              download
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-[#1F3A2C] hover:bg-[#15281e] text-white text-xs sm:text-sm font-semibold transition-all shadow-sm group"
            >
              <svg className="w-4 h-4 text-[#8fa868] group-hover:translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download Official Report (PDF, {pub.fileSize})</span>
            </a>

            <a
              href={pub.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white hover:bg-neutral-50 border border-[#ded8cb] text-xs sm:text-sm font-semibold text-[#1F3A2C] transition-colors"
            >
              <span>Open PDF in New Tab</span>
              <span className="text-xs">↗</span>
            </a>
          </div>
        </div>
      </section>

      {/* 2. STATS & KEY METRICS */}
      <section className="w-full py-10 bg-white border-b border-[#e8e2d4]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {pub.keyMetrics.map((metric, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#faf8f5] border border-[#e8e2d4]/80 space-y-1.5"
              >
                <span className="text-[11px] font-semibold tracking-wider uppercase text-[#8fa868] block font-sans">
                  {metric.label}
                </span>
                <div className="font-serif text-2xl sm:text-3xl text-[#1F3A2C] font-normal">
                  {metric.value}
                </div>
                <p className="text-xs text-[#5d7064] font-sans leading-relaxed">
                  {metric.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. EXECUTIVE SUMMARY & COVER DISPLAY */}
      <section className="w-full py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left: Executive Summary & Key Takeaways */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#bda15f] block font-sans mb-1">
                  EXECUTIVE SUMMARY
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl text-[#1F3A2C] font-normal">
                  Core Findings & Strategic Context
                </h2>
              </div>

              <p className="text-sm sm:text-[15px] text-[#3d5446] font-sans leading-relaxed">
                {pub.summary}
              </p>

              {/* Takeaways Card */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e8e2d4] shadow-xs space-y-4">
                <h3 className="font-serif text-lg text-[#1F3A2C] font-medium flex items-center gap-2">
                  <span className="text-[#8fa868]">✦</span> Key Takeaways for Wealth Builders
                </h3>
                <ul className="space-y-3 font-sans text-xs sm:text-[13.5px] text-[#4a5f51] leading-relaxed">
                  {pub.keyTakeaways.map((takeaway, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="text-[#8fa868] font-bold mt-0.5">•</span>
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right: High-Res First Page Cover Card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl overflow-hidden shadow-lg border border-[#ded8cb] bg-white group">
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-100">
                  <Image
                    src={pub.coverImage}
                    alt={`Cover preview of ${pub.title}`}
                    fill
                    priority
                    sizes="(min-width: 1024px) 33vw, 100vw"
                    className="object-cover object-top group-hover:scale-102 transition-transform duration-500"
                  />
                </div>
                <div className="p-4 bg-white border-t border-[#e8e2d4] flex items-center justify-between text-xs text-[#5d7064] font-sans">
                  <span>Official Research Publication</span>
                  <a
                    href={pub.pdfUrl}
                    download
                    className="text-[#1F3A2C] font-semibold hover:text-[#8fa868] transition-colors flex items-center gap-1"
                  >
                    <span>Download PDF</span>
                    <span>↓</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. IN-DEPTH RESEARCH SECTIONS (FULL TEXT FOR SEO & READING) */}
      <section className="w-full py-12 bg-white border-y border-[#e8e2d4]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="border-b border-[#e8e2d4] pb-4">
            <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#bda15f] block font-sans mb-1">
              IN-DEPTH ANALYSIS
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-[36px] text-[#1F3A2C] font-normal leading-tight">
              Report Sections & Detailed Data
            </h2>
          </div>

          {pub.sections.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#8fa868]">
                  Section 0{idx + 1}
                </span>
                <h3 className="font-serif text-2xl sm:text-[26px] text-[#1F3A2C] font-normal leading-snug">
                  {section.heading}
                </h3>
                {section.subhead && (
                  <h4 className="text-xs sm:text-sm font-sans font-medium text-[#7d9183] italic">
                    {section.subhead}
                  </h4>
                )}
              </div>

              <div className="space-y-3 font-sans text-sm sm:text-[15px] text-[#3d5446] leading-relaxed">
                {section.paragraphs.map((p, pIdx) => (
                  <p key={pIdx}>{p}</p>
                ))}
              </div>

              {/* Callout box if present */}
              {section.callout && (
                <div className="my-5 p-5 sm:p-6 rounded-2xl bg-[#EEF0D9]/60 border-l-4 border-[#8fa868] text-xs sm:text-sm text-[#1F3A2C] font-sans leading-relaxed">
                  <div className="font-semibold text-[#52704e] mb-1">💡 Key Insight:</div>
                  {section.callout}
                </div>
              )}

              {/* Data Table if present */}
              {section.table && (
                <div className="my-6 overflow-x-auto rounded-2xl border border-[#e8e2d4] shadow-2xs">
                  <table className="w-full text-left text-xs sm:text-sm font-sans">
                    <thead className="bg-[#1F3A2C] text-white">
                      <tr>
                        {section.table.headers.map((h, hIdx) => (
                          <th key={hIdx} className="py-3 px-4 font-semibold tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e8e2d4] bg-white text-[#3d5446]">
                      {section.table.rows.map((row, rIdx) => (
                        <tr key={rIdx} className={rIdx % 2 === 1 ? "bg-[#faf8f5]" : ""}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="py-3 px-4 font-normal">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 5. IN-BROWSER PDF PREVIEW / EMBED */}
      <section className="w-full py-16 bg-[#F5F1E8]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#bda15f] block font-sans mb-1">
                DOCUMENT PREVIEW
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl text-[#1F3A2C] font-normal">
                Read the Original Document
              </h2>
            </div>
            <a
              href={pub.pdfUrl}
              download
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#1F3A2C] hover:text-[#8fa868] transition-colors"
            >
              <span>Download PDF ({pub.fileSize})</span>
              <span>↓</span>
            </a>
          </div>

          <div className="w-full h-[650px] sm:h-[800px] rounded-3xl overflow-hidden border border-[#ded8cb] shadow-md bg-white">
            <iframe
              src={`${pub.pdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
              title={`PDF Reader for ${pub.title}`}
              className="w-full h-full border-none"
            />
          </div>
        </div>
      </section>

      {/* 6. CONTEXTUAL SERVICE CTA */}
      <section className="w-full py-16 bg-[#1F3A2C] text-[#F5F1E8]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-5">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#c5a963] block font-sans">
            ADVISORY INTEGRATION
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-white font-normal leading-tight">
            {pub.relatedService.title}
          </h2>
          <p className="text-xs sm:text-sm text-[#cfded5] font-sans max-w-xl mx-auto leading-relaxed">
            {pub.relatedService.description}
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <Link
              href={pub.relatedService.href}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-[#1F3A2C] hover:bg-[#EEF0D9] text-xs sm:text-sm font-semibold transition-all shadow-md group"
            >
              <span>{pub.relatedService.buttonText}</span>
              <ArrowRightIcon className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-white/30 text-white hover:bg-white/10 text-xs sm:text-sm font-semibold transition-colors"
            >
              <span>Discuss with a Wealth Architect</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 7. OTHER RESEARCH PUBLICATIONS */}
      <section className="w-full py-16 bg-white border-t border-[#e8e2d4]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex items-end justify-between border-b border-[#e8e2d4] pb-3">
            <div>
              <span className="font-cormorant italic text-lg sm:text-xl text-[#c5a963] block font-normal leading-tight">
                More Research
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl text-[#1F3A2C] font-normal leading-tight mt-1">
                Explore Other Publications
              </h2>
            </div>
            <Link
              href="/insights?tab=research"
              className="font-cormorant italic text-sm sm:text-base text-[#1F3A2C] hover:text-[#8fa868] transition-colors flex items-center gap-1 font-medium"
            >
              <span>View all 7 reports</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {otherPublications.map((other) => (
              <Link
                key={other.slug}
                href={`/insights/research/${other.slug}`}
                className="bg-[#faf8f5] rounded-3xl overflow-hidden border border-[#e8e2d4] p-5 space-y-3 hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#8fa868]">
                    <span>{other.category}</span>
                    <span className="text-[#968254] font-normal">{other.issueDate}</span>
                  </div>
                  <h3 className="font-sans font-semibold text-base text-[#1F3A2C] group-hover:text-[#8fa868] transition-colors line-clamp-2">
                    {other.title}
                  </h3>
                  <p className="text-xs text-[#5d7064] line-clamp-2 leading-relaxed">
                    {other.subtitle}
                  </p>
                </div>
                <div className="pt-2 text-[11px] text-[#8a9d90] font-sans flex items-center justify-between border-t border-[#e8e2d4]/60">
                  <span>📄 {other.pageCount} Pages</span>
                  <span className="text-[#1F3A2C] font-semibold group-hover:translate-x-1 transition-transform">
                    Read Report →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
