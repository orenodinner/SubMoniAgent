import React, { useEffect, useState } from "react";
import type { ChatState } from "../store/useChatStore";
import idleImage from "../assets/avater/main.png";
import talkFrame1 from "../assets/avater/talk/main.png";
import talkFrame2 from "../assets/avater/talk/4ani2.png";
import talkFrame3 from "../assets/avater/talk/4ani3.png";

type Props = {
  state: ChatState;
};

const TALK_FRAMES = [talkFrame1, talkFrame2, talkFrame3];
const TALK_INTERVAL_MS = 160; // ~6fps for lip sync

export default function CharacterCanvas({ state }: Props) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (state !== "speaking") {
      setFrameIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % TALK_FRAMES.length);
    }, TALK_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [state]);

  const currentFrame = state === "speaking" ? TALK_FRAMES[frameIndex] : idleImage;

  return <img src={currentFrame} alt="character" className="character-canvas" draggable={false} />;
}
