import MarkdownBoldText from "@/components/ui/MarkdownBoldText";
import {
  parseResumeAiDisplaySections,
  type ResumeAiDisplaySection,
} from "@/lib/resume-ai-display";

const NESTED_KEY_LINE = /^([A-Za-z][A-Za-zA-Z0-9_]*)\s*:\s*(.*)$/;

function ValueWithNestedKeys({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="whitespace-pre-wrap break-words text-slate-800 dark:text-slate-200">
      {lines.map((line, index) => {
        const match = NESTED_KEY_LINE.exec(line);
        if (match && !line.trimStart().startsWith("-")) {
          const [, key, rest] = match;
          return (
            <div key={index}>
              <span className="font-bold text-orange-600 dark:text-orange-400">{key}</span>
              {rest ? (
                <>
                  <span className="text-slate-400 dark:text-slate-500">: </span>
                  <MarkdownBoldText text={rest} />
                </>
              ) : (
                <span className="text-slate-400 dark:text-slate-500">:</span>
              )}
            </div>
          );
        }

        return (
          <div key={index}>
            {line ? <MarkdownBoldText text={line} /> : <br />}
          </div>
        );
      })}
    </div>
  );
}

function KeyValueSection({ section }: { section: ResumeAiDisplaySection }) {
  return (
    <div className="space-y-1.5">
      <p className="font-bold text-orange-600 dark:text-orange-400">{section.key}</p>
      {section.key === "experiences" ? (
        <ValueWithNestedKeys text={section.value} />
      ) : (
        <div className="whitespace-pre-wrap break-words text-slate-800 dark:text-slate-200">
          <MarkdownBoldText text={section.value} />
        </div>
      )}
    </div>
  );
}

interface ResumeAiKeyValueViewProps {
  text: string;
  showCursor?: boolean;
}

/** Renders resume JSON as bold colored keys with blank-line-separated parts. */
export default function ResumeAiKeyValueView({
  text,
  showCursor = false,
}: ResumeAiKeyValueViewProps) {
  const sections = parseResumeAiDisplaySections(text);

  if (!sections) {
    return (
      <div className="whitespace-pre-wrap break-words font-mono text-[15px] leading-relaxed">
        <MarkdownBoldText text={text} />
        {showCursor ? (
          <span
            className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-orange-500 align-baseline animate-pulse"
            aria-hidden
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5 text-[15px] leading-relaxed font-sans">
      {sections.map((section) => (
        <KeyValueSection key={section.key} section={section} />
      ))}
      {showCursor ? (
        <span
          className="inline-block h-4 w-0.5 bg-orange-500 align-baseline animate-pulse"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
