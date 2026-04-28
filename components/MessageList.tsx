"use client";
import { useEffect, useRef } from "react";
import { Message } from "@/lib/types";
import MarkdownRenderer from "./MarkdownRenderer";
import { User, Bot } from "lucide-react";

interface MessageListProps {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
  onPromptClick?: (text: string) => void;
}

const PROMPT_CHIPS = [
  "Explain quantum computing simply",
  "Write a Python web scraper",
  "Solve: x² + 5x + 6 = 0",
  "Summarize the Roman Empire",
];

export default function MessageList({
  messages,
  streamingContent,
  isStreaming,
  onPromptClick,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="empty-state">
        <div className="empty-glow" />
        <div className="empty-icon">
          <span className="empty-icon-inner">
            <Bot size={36} strokeWidth={1.5} />
          </span>
        </div>
        <h2 className="empty-title">Ask Hailey anything</h2>
        <p className="empty-subtitle">Sharp answers · Code · Math · Research</p>
        <div className="prompt-chips">
          {PROMPT_CHIPS.map((chip) => (
            <button
              key={chip}
              className="prompt-chip"
              onClick={() => onPromptClick?.(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="message-list" role="log" aria-live="polite">
      {messages.map((msg) => (
        <div key={msg.id} className={`message-row message-row--${msg.role}`}>
          <div className="message-avatar" aria-hidden="true">
            {msg.role === "user" ? (
              <User size={15} strokeWidth={2} />
            ) : (
              <Bot size={15} strokeWidth={1.8} />
            )}
          </div>
          <div className="message-bubble">
            {msg.role === "assistant" ? (
              <MarkdownRenderer content={msg.content} />
            ) : (
              <p className="user-text">{msg.content}</p>
            )}
          </div>
        </div>
      ))}

      {/* Streaming bubble */}
      {isStreaming && (
        <div className="message-row message-row--assistant">
          <div className="message-avatar" aria-hidden="true">
            <Bot size={15} strokeWidth={1.8} />
          </div>
          <div className="message-bubble">
            {streamingContent ? (
              <MarkdownRenderer content={streamingContent} streaming />
            ) : (
              <div className="typing-indicator" aria-label="Hailey is typing">
                <span /><span /><span />
              </div>
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
