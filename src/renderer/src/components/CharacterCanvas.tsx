import React, { useEffect, useRef, useState } from "react";
import spriteSheet from "../assets/pixel-sprite.png";
import { animations, CharacterState, FRAME_SIZE } from "../characterAnimations";

const CANVAS_SIZE = 512;

type Props = {
  state: CharacterState;
};

export default function CharacterCanvas({ state }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const image = new Image();
    image.src = spriteSheet;
    image.onload = () => {
      imageRef.current = image;
      setImageLoaded(true);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded || !imageRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sheet = imageRef.current;
    let frameIndex = 0;
    let rafId = 0;
    let last = 0;

    const draw = (timestamp: number) => {
      const anim = animations[state] ?? animations.idle;
      const frameDuration = 1000 / anim.fps;

      if (timestamp - last > frameDuration) {
        frameIndex = anim.loop ? (frameIndex + 1) % anim.frames : Math.min(anim.frames - 1, frameIndex + 1);
        last = timestamp;
      }

      const sx = frameIndex * FRAME_SIZE;
      const sy = anim.row * FRAME_SIZE;

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(sheet, sx, sy, FRAME_SIZE, FRAME_SIZE, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [state, imageLoaded]);

  return <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} style={{ imageRendering: "pixelated", width: "100%", maxWidth: 420 }} />;
}
