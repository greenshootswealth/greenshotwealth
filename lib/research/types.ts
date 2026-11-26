// Shared types for research reports. Safe to import from client and server code.

export interface PublicationSection {
  heading: string;
  subhead?: string;
  paragraphs: string[];
  callout?: string;
  table?: {
    headers: string[];
    rows: string[][];
  };
}

export interface KeyMetric {
  label: string;
  value: string;
  desc: string;
}

export interface RelatedService {
  title: string;
  description: string;
  href: string;
  buttonText: string;
}

/** Everything stored in the `content` JSON column of a ResearchReport. */
export interface ReportContent {
  subtitle: string;
  series: string;
  category: string;
  summary: string;
  headlineStat: { value: string; label: string };
  keyMetrics: KeyMetric[];
  keyTakeaways: string[];
  sections: PublicationSection[];
  seo: {
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
  };
  relatedService: RelatedService;
}

/** The shape the public pages render. Derived from a ResearchReport row. */
export interface Publication extends ReportContent {
  id: string;
  slug: string;
  title: string;
  status: ReportStatus;
  issueDate: string;
  publishedIso: string;
  updatedIso: string;
  readTime: string;
  pageCount: number;
  fileSize: string;
  coverImage: string;
  pdfUrl: string;
  pdfDownloadUrl: string;
}

/** What a report card in a listing needs. Keeps the full report text out of client payloads. */
export type PublicationCard = Pick<
  Publication,
  | "slug"
  | "title"
  | "subtitle"
  | "summary"
  | "category"
  | "issueDate"
  | "pageCount"
  | "fileSize"
  | "coverImage"
  | "pdfDownloadUrl"
  | "headlineStat"
> & { keywords: string[] };

export function toPublicationCard(p: Publication): PublicationCard {
  return {
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    summary: p.summary,
    category: p.category,
    issueDate: p.issueDate,
    pageCount: p.pageCount,
    fileSize: p.fileSize,
    coverImage: p.coverImage,
    pdfDownloadUrl: p.pdfDownloadUrl,
    headlineStat: p.headlineStat,
    keywords: p.seo.keywords,
  };
}

export type ReportStatus = "DRAFT" | "PUBLISHED";

/** Full record as the admin API returns it. */
export interface AdminReport {
  id: string;
  slug: string;
  status: ReportStatus;
  title: string;
  content: ReportContent;
  publishedAt: string;
  pdfUrl: string;
  coverImage: string;
  pageCount: number;
  fileSizeBytes: number;
  readMinutes: number;
  originalFilename: string | null;
  sourceText: string | null;
  aiModel: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Site pages a report's call-to-action may link to. */
export const SERVICE_LINKS: { href: string; label: string }[] = [
  { href: "/invest", label: "Invest / Goal planner" },
  { href: "/indian-investing", label: "Indian investing" },
  { href: "/global-investing", label: "Global investing" },
  { href: "/gift-city", label: "GIFT City" },
  { href: "/women-and-wealth", label: "Women & wealth" },
  { href: "/our-approach", label: "Our approach" },
  { href: "/#wealth-score", label: "Wealth score quiz" },
  { href: "/contact", label: "Contact / consultation" },
];

export const DEFAULT_RELATED_SERVICE: RelatedService = {
  title: "Turn this research into a plan",
  description:
    "Speak with a Green Shoots wealth architect about what these findings mean for your portfolio.",
  href: "/contact",
  buttonText: "Book a consultation",
};

export function emptyReportContent(): ReportContent {
  return {
    subtitle: "",
    series: "",
    category: "",
    summary: "",
    headlineStat: { value: "", label: "" },
    keyMetrics: [],
    keyTakeaways: [],
    sections: [],
    seo: { metaTitle: "", metaDescription: "", keywords: [] },
    relatedService: { ...DEFAULT_RELATED_SERVICE },
  };
}
