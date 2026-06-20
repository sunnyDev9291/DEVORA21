const BOLD_SEGMENT = /(\*\*[^*]+\*\*)/g;

export function splitMarkdownBold(text: string): Array<{ bold: boolean; text: string }> {
  if (!text) return [];

  const segments: Array<{ bold: boolean; text: string }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(BOLD_SEGMENT)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ bold: false, text: text.slice(lastIndex, index) });
    }
    segments.push({ bold: true, text: match[1].slice(2, -2) });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ bold: false, text: text.slice(lastIndex) });
  }

  return segments;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function markdownBoldToHtml(text: string): string {
  return splitMarkdownBold(text)
    .map(({ bold, text: segment }) =>
      bold ? `<strong>${escapeHtml(segment)}</strong>` : escapeHtml(segment)
    )
    .join("")
    .replace(/\n/g, "<br>");
}

export function htmlToMarkdownBold(root: HTMLElement): string {
  let out = "";

  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
    } else if (node.nodeName === "STRONG" || node.nodeName === "B") {
      const inner = node.textContent ?? "";
      out += inner ? `**${inner}**` : "";
    } else if (node.nodeName === "BR") {
      out += "\n";
    } else if (node.nodeName === "DIV" || node.nodeName === "P") {
      if (out && !out.endsWith("\n")) out += "\n";
      out += htmlToMarkdownBold(node as HTMLElement);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      out += htmlToMarkdownBold(node as HTMLElement);
    }
  }

  return out;
}
