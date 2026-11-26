"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { PublicationCard } from "@/lib/research/types";

interface PostItem {
  id: string | number;
  slug?: string;
  img?: string;
  coverImage?: string;
  title: string;
  desc?: string;
  excerpt?: string;
  date?: string;
  createdAt?: string;
  readTime?: string;
  type?: string;
  category?: string;
}

export default function InsightsContent({ publications }: { publications: PublicationCard[] }) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  
  const [activeTab, setActiveTab] = useState<"All" | "Research" | "Blogs" | "Articles">(
    initialTab === "research" || initialTab === "reports" ? "Research" : "All"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [dbPosts, setDbPosts] = useState<PostItem[]>([]);

  useEffect(() => {
    if (initialTab === "research" || initialTab === "reports") {
      setActiveTab("Research");
    }
  }, [initialTab]);

  // Fetch published blogs and articles from PostgreSQL
  useEffect(() => {
    async function loadPosts() {
      try {
        const res = await fetch("/api/blogs");
        if (res.ok) {
          const data = await res.json();
          if (data.posts && data.posts.length > 0) {
            setDbPosts(data.posts);
          }
        }
      } catch (err) {
        console.error("Failed to load blogs:", err);
      }
    }
    loadPosts();
  }, []);

  // Fallback initial items
  const fallbackBlogs: PostItem[] = [
    {
      id: "seed-1",
      slug: "discipline-behind-long-term-investing",
      img: "/img_insights_1.jpg",
      title: "The Discipline Behind Long-Term Investing",
      desc: "It's not about timing the market. It's about time in the market.",
      date: "Mar 10, 2025",
    },
    {
      id: "seed-2",
      slug: "understanding-asset-allocation-volatile-markets",
      img: "/img_insights_2.jpg",
      title: "Understanding Asset Allocation in Volatile Markets",
      desc: "Why the mathematical relationship between uncorrelated asset classes is the ultimate free lunch.",
      date: "Mar 10, 2025",
    },
    {
      id: "seed-3",
      slug: "gift-city-ifsc-gateway-dollar-wealth",
      img: "/img_insights_3.jpg",
      title: "GIFT City IFSC: The Gateway to Dollar Wealth for Indians",
      desc: "How Gujarat International Finance Tec-City opens friction-free access to USD-denominated global funds.",
      date: "Mar 10, 2025",
    },
  ];

  const fallbackArticles: PostItem[] = [
    {
      id: "seed-4",
      slug: "how-to-build-a-more-resilient-investment-portfolio",
      img: "/img_insights_4.jpg",
      title: "How to Build a More Resilient Investment Portfolio",
      desc: "Five principles to help you build a portfolio that stays aligned with your goals.",
      readTime: "6 min read",
      date: "Mar 5, 2025",
    },
    {
      id: "seed-5",
      slug: "women-and-wealth-taking-ownership",
      img: "/img_insights_5.jpg",
      title: "Women & Wealth: Taking Ownership of Your Financial Future",
      desc: "Statistically, nearly 80% of women will become solely responsible for their finances. Here is how to prepare.",
      readTime: "5 min read",
      date: "Mar 5, 2025",
    },
    {
      id: "seed-6",
      slug: "tax-planning-beyond-80c-wealth-preservation",
      img: "/img_insights_6.jpg",
      title: "Tax Planning Beyond 80C: Strategic Wealth Preservation",
      desc: "Tax efficiency is the silent compounder. How proactive asset placement maximizes your net wealth.",
      readTime: "7 min read",
      date: "Mar 5, 2025",
    },
  ];

  // Merge database posts if available
  const blogPosts =
    dbPosts.length > 0
      ? dbPosts.filter((p) => p.type === "BLOG" || !p.type)
      : fallbackBlogs;

  const articlePosts =
    dbPosts.length > 0
      ? dbPosts.filter((p) => p.type === "ARTICLE")
      : fallbackArticles;

  const showResearch =
    publications.length > 0 &&
    (activeTab === "All" || activeTab === "Research") &&
    searchQuery === "";
  const showBlogs =
    (activeTab === "All" || activeTab === "Blogs") && searchQuery === "";
  const showArticles =
    (activeTab === "All" || activeTab === "Articles") && searchQuery === "";

  // Search filtering
  const q = searchQuery.toLowerCase().trim();
  const matchingPublications = publications.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.subtitle.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.keywords.some((k) => k.toLowerCase().includes(q))
  );

  const matchingPosts = [...blogPosts, ...articlePosts].filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      (item.excerpt && item.excerpt.toLowerCase().includes(q)) ||
      (item.desc && item.desc.toLowerCase().includes(q))
  );

  return (
    <div className="w-full flex flex-col bg-[#F5F1E8] min-h-screen text-[#1F3A2C]">
      {/* 1. TOP BAR: FILTERS & SEARCH */}
      <section className="w-full pt-10 sm:pt-14 pb-8 border-b border-[#e8e2d4]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            {/* Filter Pills */}
            <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => {
                  setActiveTab("All");
                  setSearchQuery("");
                }}
                className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer shrink-0 ${
                  activeTab === "All"
                    ? "bg-[#1F3A2C] text-white shadow-sm"
                    : "bg-white text-[#526658] hover:bg-neutral-50 border border-[#e8e2d4]/80 shadow-2xs"
                }`}
              >
                All
              </button>

              <button
                onClick={() => {
                  setActiveTab("Research");
                  setSearchQuery("");
                }}
                className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  activeTab === "Research"
                    ? "bg-[#1F3A2C] text-white shadow-sm"
                    : "bg-white text-[#526658] hover:bg-neutral-50 border border-[#e8e2d4]/80 shadow-2xs"
                }`}
              >
                <span>Research & Reports</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === "Research" ? "bg-[#8fa868] text-white" : "bg-[#EEF0D9] text-[#52704e]"}`}>
                  7
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("Blogs");
                  setSearchQuery("");
                }}
                className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer shrink-0 ${
                  activeTab === "Blogs"
                    ? "bg-[#1F3A2C] text-white shadow-sm"
                    : "bg-white text-[#526658] hover:bg-neutral-50 border border-[#e8e2d4]/80 shadow-2xs"
                }`}
              >
                Blogs
              </button>

              <button
                onClick={() => {
                  setActiveTab("Articles");
                  setSearchQuery("");
                }}
                className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer shrink-0 ${
                  activeTab === "Articles"
                    ? "bg-[#1F3A2C] text-white shadow-sm"
                    : "bg-white text-[#526658] hover:bg-neutral-50 border border-[#e8e2d4]/80 shadow-2xs"
                }`}
              >
                Articles
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search insights, gold, energy, SIF..."
                className="w-full pl-5 pr-10 py-2.5 rounded-full bg-white border border-[#e8e2d4]/90 text-xs sm:text-sm text-[#1F3A2C] placeholder:text-[#9ca3af] focus:outline-none focus:ring-1 focus:ring-[#1F3A2C] shadow-2xs font-sans"
              />
              <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-gray-400">
                <svg className="w-4 h-4 text-[#8a9d90]" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                  <path
                    d="M17.5 17.5L13.875 13.875M15.8333 9.16667C15.8333 12.8486 12.8486 15.8333 9.16667 15.8333C5.48477 15.8333 2.5 12.8486 2.5 9.16667C2.5 5.48477 5.48477 2.5 9.16667 2.5C12.8486 2.5 15.8333 5.48477 15.8333 9.16667Z"
                    strokeWidth="1.67"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FEATURED RESEARCH & REPORTS SECTION (PDF PUBLICATIONS) */}
      {showResearch && (
        <section className="w-full py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#e8e2d4] pb-4">
              <div>
                <span className="font-cormorant italic text-lg sm:text-xl text-[#c5a963] block font-normal leading-tight">
                  Research & Special Issues
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl lg:text-[34px] font-normal leading-tight text-[#1F3A2C] mt-1">
                  <span>Institutional Research & </span>
                  <span className="font-cormorant italic font-semibold text-[#8fa868]">
                    Client Publications.
                  </span>
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#5d7064] font-sans max-w-md">
                In-depth reports published by Green Shoots Wealth. Available to read online or download as full PDF documents.
              </p>
            </div>

            {/* Research Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
              {publications.map((item) => (
                <div
                  key={item.slug}
                  className="bg-white rounded-3xl overflow-hidden shadow-xs border border-[#e8e2d4] hover:shadow-lg transition-all duration-300 flex flex-col justify-between group"
                >
                  <div>
                    {/* Cover Preview Image */}
                    <Link
                      href={`/insights/research/${item.slug}`}
                      className="relative h-60 w-full overflow-hidden bg-neutral-100 block cursor-pointer"
                    >
                      <Image
                        src={item.coverImage}
                        alt={item.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, 100vw"
                        className="object-cover object-top group-hover:scale-104 transition-transform duration-500"
                      />
                      <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-xs text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 font-sans">
                        <span>📄 {item.pageCount} Pages</span>
                      </div>
                    </Link>

                    {/* Card Content */}
                    <div className="p-6 sm:p-7 space-y-3">
                      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[#8fa868] font-sans">
                        <span>{item.category}</span>
                        <span className="text-[#968254] font-normal">{item.issueDate}</span>
                      </div>

                      <Link href={`/insights/research/${item.slug}`}>
                        <h3 className="font-serif font-normal text-xl sm:text-[22px] text-[#1F3A2C] leading-snug group-hover:text-[#8fa868] transition-colors line-clamp-2">
                          {item.title}
                        </h3>
                      </Link>

                      <p className="text-xs sm:text-[13px] text-[#5d7064] leading-relaxed font-sans line-clamp-2">
                        {item.subtitle}
                      </p>

                      {/* Headline Stat Highlight Pill */}
                      <div className="pt-2">
                        <div className="inline-flex items-baseline gap-1.5 px-3 py-1.5 rounded-xl bg-[#EEF0D9]/70 border border-[#8fa868]/30 text-xs text-[#1F3A2C] font-sans">
                          <span className="font-bold text-[#3d5a41]">{item.headlineStat.value}</span>
                          <span className="text-[11px] text-[#5a7061] truncate max-w-[200px]">{item.headlineStat.label}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer with Read & Download Buttons */}
                  <div className="px-6 sm:px-7 pb-6 pt-2 border-t border-[#e8e2d4]/70 flex items-center justify-between text-xs font-sans">
                    <Link
                      href={`/insights/research/${item.slug}`}
                      className="font-semibold text-[#1F3A2C] hover:text-[#8fa868] transition-colors flex items-center gap-1 group-hover:translate-x-0.5"
                    >
                      <span>Read Online</span>
                      <span>→</span>
                    </Link>

                    <a
                      href={item.pdfDownloadUrl}
                      download
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#faf8f5] hover:bg-[#EEF0D9] border border-[#ded8cb] text-[11px] font-semibold text-[#1F3A2C] transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 text-[#8fa868]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>PDF ({item.fileSize})</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. BLOGS SECTION */}
      {showBlogs && (
        <section className="w-full py-10 sm:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex items-end justify-between border-b border-transparent pb-1">
              <div>
                <span className="font-cormorant italic text-lg sm:text-xl text-[#c5a963] block font-normal leading-tight">
                  Blogs
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl lg:text-[34px] font-normal leading-tight text-[#1F3A2C] mt-1">
                  <span>Our thoughts on markets, </span>
                  <span className="font-cormorant italic font-semibold text-[#8fa868]">
                    planning and life.
                  </span>
                </h2>
              </div>
              <Link
                href="/contact"
                className="font-cormorant italic text-sm sm:text-base text-[#1F3A2C] hover:text-[#8fa868] transition-colors shrink-0 group flex items-center gap-1 font-medium"
              >
                <span>Speak with an adviser</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {blogPosts.map((item) => (
                <Link
                  key={item.id}
                  href={`/insights/${item.slug || "discipline-behind-long-term-investing"}`}
                  className="bg-white rounded-3xl overflow-hidden shadow-xs border border-[#e8e2d4]/70 hover:shadow-lg transition-all duration-300 flex flex-col group cursor-pointer"
                >
                  <div className="relative h-56 sm:h-60 w-full overflow-hidden bg-neutral-100">
                    <Image
                      src={item.coverImage || item.img || "/img_insights_1.jpg"}
                      alt={item.title}
                      fill
                      priority
                      unoptimized={Boolean(
                        (item.coverImage || item.img)?.startsWith("data:") ||
                          (item.coverImage || item.img)?.startsWith("http")
                      )}
                      className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6 sm:p-7 flex flex-col justify-between flex-1 space-y-3">
                    <div className="space-y-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8fa868]">
                        {item.category || "Investing"}
                      </span>
                      <h3 className="font-sans font-semibold text-lg sm:text-xl text-[#1F3A2C] leading-snug group-hover:text-emerald-900 transition-colors line-clamp-2">
                        {item.title}
                      </h3>
                      <p className="text-xs sm:text-[13px] text-[#5d7064] leading-relaxed font-sans line-clamp-2">
                        {item.excerpt || item.desc}
                      </p>
                    </div>
                    <div className="pt-2 text-[11px] text-[#8a9d90] font-sans font-medium flex items-center justify-between">
                      <span>
                        {item.date ||
                          (item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Mar 10, 2025")}
                      </span>
                      <span className="text-[#1F3A2C] font-semibold group-hover:translate-x-1 transition-transform">
                        Read →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 4. ARTICLES SECTION */}
      {showArticles && (
        <section className="w-full py-10 sm:py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex items-end justify-between border-b border-transparent pb-1">
              <div>
                <span className="font-cormorant italic text-lg sm:text-xl text-[#c5a963] block font-normal leading-tight">
                  Articles
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl lg:text-[34px] font-normal leading-tight text-[#1F3A2C] mt-1">
                  <span>In-depth reads on </span>
                  <span className="font-cormorant italic font-semibold text-[#8fa868]">
                    topics that matter.
                  </span>
                </h2>
              </div>
              <Link
                href="/contact"
                className="font-cormorant italic text-sm sm:text-base text-[#1F3A2C] hover:text-[#8fa868] transition-colors shrink-0 group flex items-center gap-1 font-medium"
              >
                <span>Speak with an adviser</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {articlePosts.map((item) => (
                <Link
                  key={item.id}
                  href={`/insights/${item.slug || "how-to-build-a-more-resilient-investment-portfolio"}`}
                  className="bg-white rounded-3xl overflow-hidden shadow-xs border border-[#e8e2d4]/70 hover:shadow-lg transition-all duration-300 flex flex-col group cursor-pointer"
                >
                  <div className="relative h-56 sm:h-60 w-full overflow-hidden bg-neutral-100">
                    <Image
                      src={item.coverImage || item.img || "/img_insights_4.jpg"}
                      alt={item.title}
                      fill
                      priority
                      unoptimized={Boolean(
                        (item.coverImage || item.img)?.startsWith("data:") ||
                          (item.coverImage || item.img)?.startsWith("http")
                      )}
                      className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6 sm:p-7 flex flex-col justify-between flex-1 space-y-3">
                    <div className="space-y-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8fa868]">
                        {item.category || "Wealth Architecture"}
                      </span>
                      <h3 className="font-sans font-semibold text-lg sm:text-xl text-[#1F3A2C] leading-snug group-hover:text-emerald-900 transition-colors line-clamp-2">
                        {item.title}
                      </h3>
                      <p className="text-xs sm:text-[13px] text-[#5d7064] leading-relaxed font-sans line-clamp-2">
                        {item.excerpt || item.desc}
                      </p>
                    </div>
                    <div className="pt-2 text-[11px] text-[#8a9d90] font-sans font-medium flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{item.readTime || "5 min read"}</span>
                        <span>|</span>
                        <span>
                          {item.date ||
                            (item.createdAt
                              ? new Date(item.createdAt).toLocaleDateString("en-IN", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "Mar 5, 2025")}
                        </span>
                      </div>
                      <span className="text-[#1F3A2C] font-semibold group-hover:translate-x-1 transition-transform">
                        Read →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. SEARCH RESULTS (IF USER TYPES A SEARCH QUERY) */}
      {searchQuery !== "" && (
        <section className="w-full py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="border-b border-[#e8e2d4] pb-3">
              <h3 className="font-serif text-2xl text-[#1F3A2C]">
                Search results for &ldquo;{searchQuery}&rdquo;
              </h3>
              <p className="text-xs text-[#5d7064] font-sans mt-1">
                Found {matchingPublications.length} research reports and {matchingPosts.length} articles/blogs.
              </p>
            </div>

            {/* Matching Publications */}
            {matchingPublications.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-xs font-semibold tracking-wider uppercase text-[#8fa868] font-sans">
                  Research Reports (PDFs)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {matchingPublications.map((pub) => (
                    <div
                      key={pub.slug}
                      className="bg-white rounded-3xl overflow-hidden border border-[#e8e2d4] p-6 space-y-3 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-semibold uppercase text-[#8fa868]">
                          <span>{pub.category}</span>
                          <span className="text-[#968254]">{pub.issueDate}</span>
                        </div>
                        <Link href={`/insights/research/${pub.slug}`}>
                          <h5 className="font-serif text-xl text-[#1F3A2C] hover:text-[#8fa868] transition-colors leading-snug">
                            {pub.title}
                          </h5>
                        </Link>
                        <p className="text-xs text-[#5d7064] line-clamp-2 leading-relaxed">
                          {pub.subtitle}
                        </p>
                      </div>
                      <div className="pt-3 border-t border-[#e8e2d4]/70 flex items-center justify-between text-xs">
                        <Link
                          href={`/insights/research/${pub.slug}`}
                          className="font-semibold text-[#1F3A2C] hover:text-[#8fa868]"
                        >
                          Read Report →
                        </Link>
                        <a
                          href={pub.pdfDownloadUrl}
                          download
                          className="text-[11px] text-[#8fa868] font-semibold hover:underline"
                        >
                          PDF ({pub.fileSize})
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Matching Articles & Blogs */}
            {matchingPosts.length > 0 && (
              <div className="space-y-4 pt-4">
                <h4 className="text-xs font-semibold tracking-wider uppercase text-[#8fa868] font-sans">
                  Articles & Blogs
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {matchingPosts.map((item) => (
                    <Link
                      key={item.id}
                      href={`/insights/${item.slug || "discipline-behind-long-term-investing"}`}
                      className="bg-white rounded-3xl overflow-hidden shadow-xs border border-[#e8e2d4]/70 p-6 space-y-3 hover:shadow-md transition-shadow block group"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8fa868]">
                        {item.category || item.type || "Insight"}
                      </span>
                      <h5 className="font-sans font-semibold text-lg text-[#1F3A2C] group-hover:text-[#8fa868] transition-colors">
                        {item.title}
                      </h5>
                      <p className="text-xs text-[#5d7064] line-clamp-2">
                        {item.excerpt || item.desc}
                      </p>
                      <div className="text-[11px] text-[#8a9d90] pt-1">
                        {item.date ||
                          (item.createdAt
                            ? new Date(item.createdAt).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Mar 10, 2025")}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {matchingPublications.length === 0 && matchingPosts.length === 0 && (
              <div className="p-12 text-center bg-white rounded-3xl border border-[#e8e2d4]">
                <p className="text-sm text-[#5d7064] font-sans">
                  No insights found matching &ldquo;{searchQuery}&rdquo;. Try searching for &ldquo;gold&rdquo;, &ldquo;energy&rdquo;, &ldquo;SIF&rdquo;, &ldquo;GIFT City&rdquo;, or &ldquo;Nifty&rdquo;.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 6. THE GSW APP CARD */}
      <section className="w-full py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="relative bg-white rounded-3xl p-10 sm:p-14 border border-[#e8e2d4] shadow-sm text-center space-y-5 overflow-hidden">
            <div
              className="absolute inset-0 bg-cover bg-center pointer-events-none"
              style={{ backgroundImage: "url('/images/card_silk_exact.jpg')" }}
            />

            <div className="relative z-10 space-y-3 max-w-xl mx-auto">
              <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#bda15f] block font-sans">
                THE GSW APP
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-[42px] text-[#1F3A2C] font-normal leading-tight">
                <span>Your whole financial life, </span>
                <br />
                <span className="italic">in one quiet place.</span>
              </h2>
              <p className="text-xs sm:text-sm text-[#5d7064] font-sans max-w-md mx-auto leading-relaxed pt-1">
                Track investments, set goals, get nudges from your advisor, and learn at your pace. Free to download. Always.
              </p>

              <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
                <a
                  href="https://apps.apple.com/in/app/green-shoots-wealth/id6778030809"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
                >
                  <span> Download on the App Store</span>
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=com.greenshoots.greenshootswealth"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-[#1b3628] text-white text-xs font-semibold hover:bg-[#12281c] transition-colors shadow-sm cursor-pointer"
                >
                  <span>▶ GET IT ON Google Play</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
