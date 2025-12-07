import React from "react";
import { render, screen } from "@testing-library/react";
import ChatView from "../ChatView";
import type { Message } from "../../store/useChatStore";

describe("ChatView", () => {
  it("renders a list of messages", () => {
    const mockMessages: Message[] = [
      { id: "1", role: "user", content: "こんにちは", timestamp: "2023-01-01T10:00:00Z" },
      { id: "2", role: "assistant", content: "はい、元気です", timestamp: "2023-01-01T10:00:01Z" },
    ];

    render(<ChatView messages={mockMessages} />);

    expect(screen.getByText("こんにちは")).toBeInTheDocument();
    expect(screen.getByText("はい、元気です")).toBeInTheDocument();
  });
});
