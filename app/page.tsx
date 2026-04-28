"use client";
import { useCallback, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import MessageList from "@/components/MessageList";
import ChatInput from "@/components/ChatInput";
import ModelBadge from "@/components/ModelBadge";
import { useChatStream, makeUserMessage } from "@/hooks/useChatStream";
import { useHistory } from "@/hooks/useHistory";
import { ActiveModel, Message } from "@/lib/types";
import { AlertTriangle } from "lucide-react";

export default function HomePage() {
  const history = useHistory();
  const [streamingContent, setStreamingContent] = useState("");
  const [activeModel, setActiveModel] = useState<ActiveModel>("groq");
  const [error, setError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState("");

  // Keep a ref to the active chat ID so handleDone never goes stale
  const activeChatIdRef = useRef<string | null>(null);
  activeChatIdRef.current = history.activeChatId;

  const handleToken = useCallback((token: string) => {
    setStreamingContent((prev) => prev + token);
  }, []);

  const handleDone = useCallback(
    (fullText: string) => {
      setStreamingContent("");
      const chatId = activeChatIdRef.current;
      if (!chatId || !fullText.trim()) return;
      // history.updateMessages reads from chatsRef internally, so this is always fresh
      history.appendAssistantMessage(chatId, fullText);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history.appendAssistantMessage]
  );

  const handleModelSwitch = useCallback((model: ActiveModel) => {
    setActiveModel(model);
  }, []);

  const handleError = useCallback((msg: string) => {
    try {
      const parsed = JSON.parse(msg);
      setError(parsed.error ?? parsed.message ?? msg);
    } catch {
      setError(msg);
    }
    setStreamingContent("");
  }, []);

  const { isStreaming, sendMessages, abort } = useChatStream({
    onToken: handleToken,
    onDone: handleDone,
    onModelSwitch: handleModelSwitch,
    onError: handleError,
  });

  const handleSend = useCallback(
    (text: string) => {
      try {
        setError(null);
        setPrefill("");
        let chat = history.activeChat;
        if (!chat) {
          chat = history.createChat();
        }
        if (!chat) return;

        const userMsg = makeUserMessage(text);
        const existingMessages: Message[] = chat.messages ?? [];
        const newMessages: Message[] = [...existingMessages, userMsg];

        const autoTitle =
          chat.title === "New Chat"
            ? text.slice(0, 48) + (text.length > 48 ? "…" : "")
            : undefined;

        history.updateMessages(chat.id, newMessages, autoTitle);
        sendMessages(newMessages).catch((e: unknown) => setError(String(e)));
      } catch (e) {
        setError(String(e));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history.activeChat, history.createChat, history.updateMessages, sendMessages]
  );

  const handlePromptClick = useCallback((text: string) => {
    setPrefill(text);
  }, []);

  const currentMessages = history.activeChat?.messages ?? [];

  return (
    <div className="app-shell">
      <Sidebar
        chats={history.chats}
        activeChatId={history.activeChatId}
        onSelect={history.setActiveChatId}
        onCreate={history.createChat}
        onRename={history.renameChat}
        onDelete={history.deleteChat}
      />

      <main className="chat-main">
        <header className="chat-header">
          <span className="chat-header-title">
            {history.activeChat?.title ?? "Hailey"}
          </span>
          <ModelBadge model={activeModel} />
        </header>

        <div className="messages-area">
          <MessageList
            messages={currentMessages}
            streamingContent={streamingContent}
            isStreaming={isStreaming}
            onPromptClick={handlePromptClick}
          />
        </div>

        {error && (
          <div className="error-toast" role="alert">
            <AlertTriangle size={15} />
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error">✕</button>
          </div>
        )}

        <ChatInput
          onSend={handleSend}
          onStop={abort}
          isStreaming={isStreaming}
          disabled={isStreaming}
          prefill={prefill}
        />
      </main>
    </div>
  );
}
