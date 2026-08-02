export function extractPRDTitle(
  markdown: string,
  brief?: string,
  summary?: any
): string {
  // 1. If projectType from summary is available and specific
  if (summary?.projectType && summary.projectType !== "Tidak terdeteksi" && summary.projectType.trim().length > 0) {
    let t = summary.projectType.trim();
    if (!t.toLowerCase().startsWith("prd")) {
      t = `PRD — ${t}`;
    }
    return t;
  }

  // 2. Try from brief if available
  if (brief && brief.trim().length > 0) {
    let clean = brief
      .trim()
      .replace(/^(saya\s+ingin\s+membuat|buatkan\s+saya|buat\s+prd\s+untuk|aplikasi|sistem)\s+/i, "");
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    if (clean.length > 55) {
      clean = clean.substring(0, 52) + "...";
    }
    return clean;
  }

  // 3. Try to extract specific H1 heading from markdown
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) {
    const headerText = h1Match[1].trim();
    if (
      headerText !== "PRD — Project Requirements Document" &&
      headerText !== "Project Requirements Document" &&
      headerText !== "Assumptions" &&
      headerText !== "PRD Document"
    ) {
      return headerText;
    }
  }

  // 4. Try to find first heading with context
  const lines = markdown.split("\n");
  for (const line of lines) {
    const match = line.match(/^#{1,3}\s+(.+)$/);
    if (match) {
      const text = match[1].trim();
      const lower = text.toLowerCase();
      if (
        !lower.includes("project requirements document") &&
        !lower.includes("assumptions") &&
        !lower.includes("overview") &&
        !lower.includes("requirements") &&
        !lower.includes("core features")
      ) {
        return text;
      }
    }
  }

  return "PRD Document";
}
