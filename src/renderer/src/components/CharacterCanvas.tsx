import React, { useEffect, useState } from "react";
import type { ChatState } from "../store/useChatStore";
import idleImage from "../assets/avater/main.png";
import talkFrame1 from "../assets/avater/talk/main.png";
import talkFrame2 from "../assets/avater/talk/4ani2.png";
import talkFrame3 from "../assets/avater/talk/4ani3.png";

type Props = {
  state: ChatState;
  enableCodecLines?: boolean;
};

const TALK_FRAMES = [talkFrame1, talkFrame2, talkFrame3];
const TALK_INTERVAL_MS = 160; // ~6fps for lip sync

export default function CharacterCanvas({ state, enableCodecLines = true }: Props) {
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

  const sweepLayers = [
    { className: "codec-lines", delay: "-0.8s" },
    { className: "codec-lines", delay: "-2.4s" },
    { className: "codec-lines mid", delay: "-1.6s" },
   // { className: "codec-lines mid", delay: "-3.1s" },
  //  { className: "codec-lines slow", delay: "-1.3s" },
    { className: "codec-lines slow", delay: "-3.8s" },
  ];

  return (
    <div className="character-layer">
      <img src={currentFrame} alt="character" className="character-canvas" draggable={false} />
      {enableCodecLines &&
        sweepLayers.map((layer, idx) => (
          <div className={layer.className} style={{ animationDelay: layer.delay }} aria-hidden key={idx} />
        ))}
    </div>
  );
}
