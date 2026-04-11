import ReactMarkdown from "react-markdown";

type ChatAssistantMarkdownProps = {
  content: string;
  /** 말풍선 안에서만 쓰는 추가 클래스 (text-xs 등) */
  className?: string;
};

/**
 * OpenAI 등이 마크다운(**굵게**, 목록 등)으로 답할 때 그대로 두면 `**`가 보임.
 * 렌더링하면 별표 없이 스타일만 적용됨.
 */
export function ChatAssistantMarkdown({ content, className = "" }: ChatAssistantMarkdownProps) {
  return (
    <div className={`break-words text-foreground [&_a]:text-primary [&_a]:underline ${className}`}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="mb-1.5 list-disc pl-4 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-1.5 list-decimal pl-4 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          h1: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
          h2: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
          h3: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
          hr: () => <hr className="my-2 border-border" />,
          code: ({ className: codeClass, children }) => (
            <code className={`rounded bg-muted px-1 py-0.5 font-mono text-[0.95em] ${codeClass ?? ""}`}>{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="mb-1 max-w-full overflow-x-auto rounded-md bg-muted p-2 text-[11px] leading-snug">{children}</pre>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-2 text-muted-foreground">{children}</blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
