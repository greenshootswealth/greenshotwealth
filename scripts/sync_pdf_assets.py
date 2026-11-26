import os
import shutil
import fitz

repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
pdf_src_dir = os.path.join(repo_root, "pdf")
pdf_dest_dir = os.path.join(repo_root, "public", "pdf")
img_dest_dir = os.path.join(repo_root, "public", "images", "publications")

os.makedirs(pdf_dest_dir, exist_ok=True)
os.makedirs(img_dest_dir, exist_ok=True)

publications = [
    {
        "src_pdf": "Energy-Newsletter.pdf",
        "clean_pdf": "energy-infrastructure-india-next-decade.pdf",
        "cover_img": "energy-infrastructure-cover.jpg",
    },
    {
        "src_pdf": "GOLD newsletter.pdf",
        "clean_pdf": "the-case-for-gold-50-years-indian-data.pdf",
        "cover_img": "gold-50-years-cover.jpg",
    },
    {
        "src_pdf": "Gift City newsletter.pdf",
        "clean_pdf": "investing-through-gift-city-dollar-wealth.pdf",
        "cover_img": "gift-city-investing-cover.jpg",
    },
    {
        "src_pdf": "Investor Behavior newsletter.pdf",
        "clean_pdf": "investor-behavior-staying-invested-nifty-history.pdf",
        "cover_img": "investor-behavior-cover.jpg",
    },
    {
        "src_pdf": "Make your own bouns after retirement .pdf",
        "clean_pdf": "make-your-own-bonus-after-retirement-diwali-corpus.pdf",
        "cover_img": "retirement-bonus-cover.jpg",
    },
    {
        "src_pdf": "Newsletter SIF.pdf",
        "clean_pdf": "specialised-investment-funds-sif-guide.pdf",
        "cover_img": "sif-funds-cover.jpg",
    },
    {
        "src_pdf": "make your first 1 CR .pdf",
        "clean_pdf": "your-first-1-crore-sip-roadmap.pdf",
        "cover_img": "first-1-crore-cover.jpg",
    },
]

print("Syncing PDF assets and generating high-res covers...")
for pub in publications:
    src_path = os.path.join(pdf_src_dir, pub["src_pdf"])
    if not os.path.exists(src_path):
        print(f"Warning: {src_path} not found")
        continue

    # 1. Copy original filename
    dest_orig = os.path.join(pdf_dest_dir, pub["src_pdf"])
    shutil.copy2(src_path, dest_orig)

    # 2. Copy clean canonical filename
    dest_clean = os.path.join(pdf_dest_dir, pub["clean_pdf"])
    shutil.copy2(src_path, dest_clean)

    # 3. Render high-res first page as JPG cover image
    cover_path = os.path.join(img_dest_dir, pub["cover_img"])
    doc = fitz.open(src_path)
    page = doc[0]
    pix = page.get_pixmap(dpi=150)
    pix.save(cover_path)
    doc.close()

    print(f"✓ Synced: {pub['clean_pdf']} and generated {pub['cover_img']}")

print("All PDF assets and covers synced successfully!")
