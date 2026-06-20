import { splitMarkdownBold } from "@/lib/markdown-bold";

interface MarkdownBoldTextProps {
  text: string;
  className?: string;
}

export default function MarkdownBoldText({ text, className = "" }: MarkdownBoldTextProps) {
  const segments = splitMarkdownBold(text);

  if (segments.length === 0) {
    return null;
  }

  return (
    <span className={className}>
      {segments.map((segment, index) =>
        segment.bold ? (
          <strong key={index} className="font-semibold text-slate-950 dark:text-white">
            {segment.text}
          </strong>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </span>
  );
}
