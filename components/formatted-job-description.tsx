"use client";

import DOMPurify from "dompurify";
import { Fragment, ReactNode, useMemo } from "react";
import { mergeHtmlContinuationParagraphs } from "@/lib/html-content";

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      const key = `${keyPrefix}-${index}`;

      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={key}>{part.slice(2, -2)}</strong>;
      }

      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={key}>{part.slice(1, -1)}</em>;
      }

      return <Fragment key={key}>{part}</Fragment>;
    });
}

function renderPlainTextDescription(content: string, className: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: Array<
    | { type: "paragraph"; value: string }
    | { type: "list"; items: string[] }
  > = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];

  function flushParagraph() {
    if (paragraphBuffer.length === 0) {
      return;
    }

    blocks.push({
      type: "paragraph",
      value: paragraphBuffer.join(" "),
    });
    paragraphBuffer = [];
  }

  function flushList() {
    if (listBuffer.length === 0) {
      return;
    }

    blocks.push({
      type: "list",
      items: listBuffer,
    });
    listBuffer = [];
  }

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      return;
    }

    if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
      flushParagraph();
      listBuffer.push(trimmedLine.slice(2).trim());
      return;
    }

    flushList();
    paragraphBuffer.push(trimmedLine);
  });

  flushParagraph();
  flushList();

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.type === "list") {
          return (
            <ul key={`list-${index}`} className="list-disc space-y-2 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`list-${index}-${itemIndex}`}>
                  {renderInlineMarkdown(item, `list-${index}-${itemIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`paragraph-${index}`}>
            {renderInlineMarkdown(block.value, `paragraph-${index}`)}
          </p>
        );
      })}
    </div>
  );
}


function stripMarkup(content: string) {
  return content
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface FormattedJobDescriptionProps {
  content: string;
  className?: string;
}

export function FormattedJobDescription({
  content,
  className,
}: FormattedJobDescriptionProps) {
  const resolvedClassName =
    className ?? "job-rich-content space-y-3 text-sm leading-7 text-muted";
  const hasHtmlMarkup = /<\/?[a-z][\s\S]*>/i.test(content);

  const sanitizedHtml = useMemo(() => {
    if (!hasHtmlMarkup) return "";

    const raw = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ["p", "strong", "em", "u", "s", "ul", "ol", "li"],
      ALLOWED_ATTR: [],
    });

    return mergeHtmlContinuationParagraphs(raw);
  }, [content, hasHtmlMarkup]);

  if (hasHtmlMarkup) {
    if (!stripMarkup(sanitizedHtml)) return null;

    return (
      <div
        className={resolvedClassName}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }

  if (!content.trim()) return null;

  return renderPlainTextDescription(content, resolvedClassName);
}
