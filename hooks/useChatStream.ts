"use client";
import { useCallback, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { ActiveModel, Message } from "@/lib/types";

interface UseChatStreamOptions {
  onToken: (token: string) => void;
  onDone: (fullText: string) => void;
  onModelSwitch: (model: ActiveModel) => void;
  onError: (msg: string) => void;
}

export function useChatStream({
  onToken,
  onDone,
  onModelSwitch,
  onError,
}: UseChatStreamOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessages = useCallback(
    async (messages: Message[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);

      let fullText = "";
      let modelHeaderProcessed = false;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => "Unknown error");
          onError(errText);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          let chunk = decoder.decode(value, { stream: true });

          // Parse model header from the first chunk
          if (!modelHeaderProcessed && chunk.startsWith("__MODEL__:")) {
            const newline = chunk.indexOf("\n");
            const header = chunk.slice(10, newline);
            onModelSwitch(header as ActiveModel);
            chunk = chunk.slice(newline + 1);
            modelHeaderProcessed = true;
          }

          fullText += chunk;
          onToken(chunk);
        }

        onDone(fullText);
      } catch (err: unknown) {
        if ((err as Error).name === "AbortError") return;
        onError((err as Error).message ?? "Stream error");
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [onToken, onDone, onModelSwitch, onError]
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { isStreaming, sendMessages, abort };
}

// ── Message list factory helpers ────────────────────────────────────────────
export function makeUserMessage(content: string): Message {
  return { id: uuidv4(), role: "user", content };
}

export function makeAssistantMessage(content: string): Message {
  return { id: uuidv4(), role: "assistant", content };
}
