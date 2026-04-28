"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Chat, Message } from "@/lib/types";

function makeAssistantMsg(content: string): Message {
  return { id: uuidv4(), role: "assistant", content };
}

const STORAGE_KEY = "hailey_chats";

function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Chat[]) : [];
  } catch {
    return [];
  }
}

function saveChats(chats: Chat[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

export function useHistory() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  // Keep a ref that always holds the latest chats so callbacks never go stale
  const chatsRef = useRef<Chat[]>(chats);
  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    const loaded = loadChats();
    setChats(loaded);
    chatsRef.current = loaded;
  }, []);

  const persist = useCallback((updated: Chat[]) => {
    chatsRef.current = updated;
    setChats(updated);
    saveChats(updated);
  }, []);

  /** Creates a new chat, persists it, sets it active, and returns it. */
  const createChat = useCallback((): Chat => {
    const chat: Chat = {
      id: uuidv4(),
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    // Use the ref so we always prepend to the freshest list
    persist([chat, ...chatsRef.current]);
    setActiveChatId(chat.id);
    return chat;
  }, [persist]);

  const updateMessages = useCallback(
    (chatId: string, messages: Message[], autoTitle?: string) => {
      // Use the ref so stale closure is never an issue
      const updated = chatsRef.current.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages,
              updatedAt: Date.now(),
              title: autoTitle ?? c.title,
            }
          : c
      );
      persist(updated);
    },
    [persist]
  );

  /** Safely append an assistant message to a chat using the latest state from ref. */
  const appendAssistantMessage = useCallback(
    (chatId: string, content: string) => {
      const chat = chatsRef.current.find((c) => c.id === chatId);
      if (!chat) return;
      const assistantMsg = makeAssistantMsg(content);
      const updated = chatsRef.current.map((c) =>
        c.id === chatId
          ? { ...c, messages: [...c.messages, assistantMsg], updatedAt: Date.now() }
          : c
      );
      persist(updated);
    },
    [persist]
  );

  const renameChat = useCallback(
    (chatId: string, newTitle: string) => {
      const updated = chatsRef.current.map((c) =>
        c.id === chatId ? { ...c, title: newTitle } : c
      );
      persist(updated);
    },
    [persist]
  );

  const deleteChat = useCallback(
    (chatId: string) => {
      const updated = chatsRef.current.filter((c) => c.id !== chatId);
      persist(updated);
      setActiveChatId((prev) =>
        prev === chatId ? (updated.length > 0 ? updated[0].id : null) : prev
      );
    },
    [persist]
  );

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  return {
    chats,
    activeChat,
    activeChatId,
    setActiveChatId,
    createChat,
    updateMessages,
    appendAssistantMessage,
    renameChat,
    deleteChat,
  };
}
