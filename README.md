This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# greenshotwealth

## Research reports (PDF → web page)

Admins add research reports from **/admin → Research Reports**. Drop a PDF and:

1. The browser reads the PDF (text, page count) and renders page 1 as the cover image.
2. The PDF and cover upload straight to **Vercel Blob**, so large files skip the serverless body limit.
3. A draft is created and **Groq** (`openai/gpt-oss-120b` by default) writes the web edition: title, summary, metrics, sections, tables, SEO and call to action. It only uses what is in the PDF.
4. The editor flags every figure on the page that can't be found in the PDF text. Review it, then press **Publish**. Nothing goes live before that.

Publishing, editing, unpublishing or deleting refreshes `/insights`, the report page and the sitemap straight away.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Set automatically once a Blob store is connected (Vercel → Storage → Blob → connect to project). Run `vercel env pull` to use it locally. |
| `GROQ_API_KEY` | Groq API key for drafting reports. |
| `GROQ_MODEL` | Optional. Defaults to `openai/gpt-oss-120b`. |

### Code map

- `lib/research/`: types, content validation, figure checker, Groq generator, cached queries
- `app/api/admin/research/`: upload tokens, CRUD, generate
- `components/admin/research/`: drop zone, list and editor
- `components/research/ReportView.tsx`: the report page, shared by the public route and `/admin/research/preview/[id]`
- `npm run research:seed`: one-time import of the original hand-written reports (`scripts/data/legacy-publications.ts`). Safe to re-run; it never overwrites existing reports.
