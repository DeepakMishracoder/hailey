"use client";
import { useCallback, useEffect, useRef, KeyboardEvent } from "react";
import { Send, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  prefill?: string;
}

export default function ChatInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
  prefill,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, []);

  useEffect(() => { resize(); }, [resize]);

  // When a prompt chip is clicked, fill the textarea
  useEffect(() => {
    if (prefill && textareaRef.current) {
      textareaRef.current.value = prefill;
      resize();
      textareaRef.current.focus();
    }
  }, [prefill, resize]);

  function handleSend() {
    const el = textareaRef.current;
    if (!el) return;
    const text = el.value.trim();
    if (!text || isStreaming) return;
    onSend(text);
    el.value = "";
    el.style.height = "auto";
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="input-bar">
      <div className="input-wrapper">
        <textarea
          id="chat-textarea"
          ref={textareaRef}
          className="chat-textarea"
          placeholder="Message Hailey… (Shift+Enter for newline)"
          rows={1}
          onInput={resize}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label="Chat message input"
        />
        <button
          id={isStreaming ? "stop-btn" : "send-btn"}
          className={`send-btn ${isStreaming ? "send-btn--stop" : ""}`}
          onClick={isStreaming ? onStop : handleSend}
          aria-label={isStreaming ? "Stop generation" : "Send message"}
          disabled={!isStreaming && disabled}
        >
          {isStreaming ? <Square size={16} fill="currentColor" /> : <Send size={16} />}
        </button>
      </div>
      <p className="input-hint">
        Hailey can make mistakes. Verify important information.
      </p>
    </div>
  );
}
