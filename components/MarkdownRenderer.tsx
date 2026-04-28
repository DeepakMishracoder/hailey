"use client";
import { useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { Copy, Check } from "lucide-react";
import type { Components } from "react-markdown";

function CodeBlock({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const code = String(children ?? "").trimEnd();
  const lang = (className ?? "").replace("language-", "") || "text";

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [code]);

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-lang">{lang}</span>
        <button
          className={`copy-btn ${copied ? "copy-btn--done" : ""}`}
          onClick={copy}
          aria-label="Copy code"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>
      <pre className={className}>
        <code className={className}>{code}</code>
      </pre>
    </div>
  );
}

const components: Components = {
  code({ className, children, ...rest }) {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return <CodeBlock className={className}>{children}</CodeBlock>;
    }
    return (
      <code className="inline-code" {...rest}>
        {children}
      </code>
    );
  },
  // Ensure tables get a wrapper for horizontal scroll
  table({ children }) {
    return (
      <div className="table-wrapper">
        <table>{children}</table>
      </div>
    );
  },
};

interface MarkdownRendererProps {
  content: string;
  streaming?: boolean;
}

export default function MarkdownRenderer({ content, streaming }: MarkdownRendererProps) {
  return (
    <div className={`markdown-body ${streaming ? "markdown-streaming" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
