import React, { useEffect, useRef } from "react";
import { Message } from "../store/useChatStore";

type Props = {
  messages: Message[];
};

export default function ChatView({ messages }: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="messages" ref={listRef}>
      {messages.map((msg) => (
        <div className={`message-row ${msg.role}`} key={msg.id}>
          <div className={`bubble ${msg.role}`}>
            <div>{msg.content || "…"}</div>
            <div className="meta">
              <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
              {msg.model && <span>{msg.model}</span>}
              {msg.streaming && <span>streaming…</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
