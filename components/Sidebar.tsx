"use client";
import { useState, useRef, useEffect } from "react";
import { MessageSquarePlus, Trash2, Pencil, Check, X, Bot } from "lucide-react";
import { Chat } from "@/lib/types";

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Sidebar({
  chats,
  activeChatId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  function startEdit(chat: Chat) {
    setEditingId(chat.id);
    setEditValue(chat.title);
  }

  function commitEdit(id: string) {
    if (editValue.trim()) onRename(id, editValue.trim());
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  // Group chats by date label
  const groups: Record<string, Chat[]> = {};
  for (const chat of chats) {
    const label = formatDate(chat.updatedAt);
    if (!groups[label]) groups[label] = [];
    groups[label].push(chat);
  }

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <Bot size={20} strokeWidth={1.8} className="brand-icon" />
          <span className="brand-name">Hailey</span>
        </div>
        <button
          id="new-chat-btn"
          className="new-chat-btn"
          onClick={onCreate}
          title="New Chat"
          aria-label="New Chat"
        >
          <MessageSquarePlus size={17} />
        </button>
      </div>

      {/* Chat list */}
      <nav className="chat-list" role="list">
        {chats.length === 0 && (
          <p className="chat-list-empty">No conversations yet.</p>
        )}
        {Object.entries(groups).map(([label, group]) => (
          <div key={label} className="chat-group">
            <p className="chat-group-label">{label}</p>
            {group.map((chat) => (
              <div
                key={chat.id}
                role="listitem"
                className={`chat-item ${chat.id === activeChatId ? "chat-item--active" : ""}`}
                onClick={() => onSelect(chat.id)}
              >
                {editingId === chat.id ? (
                  <div className="chat-item-edit" onClick={(e) => e.stopPropagation()}>
                    <input
                      ref={inputRef}
                      className="chat-item-edit-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit(chat.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      maxLength={60}
                    />
                    <button
                      className="icon-btn icon-btn--confirm"
                      onClick={() => commitEdit(chat.id)}
                      aria-label="Confirm rename"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      className="icon-btn icon-btn--cancel"
                      onClick={cancelEdit}
                      aria-label="Cancel rename"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="chat-item-title">{chat.title}</span>
                    <div className="chat-item-actions">
                      <button
                        className="icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(chat);
                        }}
                        aria-label="Rename chat"
                        title="Rename"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="icon-btn icon-btn--danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(chat.id);
                        }}
                        aria-label="Delete chat"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
