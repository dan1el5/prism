"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Beams with a clear gap from the triangle edges
const LEFT_BEAMS = [
  { x1: -35, y1: 20, x2: 15, y2: 45, color: "#818cf8", delay: 1.0 },
  { x1: -35, y1: 45, x2: 10, y2: 62, color: "#a78bfa", delay: 1.15 },
  { x1: -35, y1: 70, x2: 8,  y2: 78, color: "#c084fc", delay: 1.3 },
];
const RIGHT_BEAMS = [
  { x1: 85, y1: 45, x2: 135, y2: 20, color: "#34d399", delay: 1.0 },
  { x1: 88, y1: 55, x2: 135, y2: 40, color: "#fbbf24", delay: 1.1 },
  { x1: 90, y1: 65, x2: 135, y2: 60, color: "#f87171", delay: 1.2 },
  { x1: 91, y1: 73, x2: 135, y2: 75, color: "#ec4899", delay: 1.3 },
  { x1: 92, y1: 82, x2: 135, y2: 92, color: "#818cf8", delay: 1.4 },
];

export function Hero() {
  const [question, setQuestion] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 5) return;
    router.push(`/explore/live?q=${encodeURIComponent(q)}`);
  }

  return (
    <section className="relative flex flex-col items-center text-center py-4 sm:py-16 px-4 overflow-hidden">
      {/* Dot grid background — no mask on mobile, masked on desktop */}
      <div
        className="absolute inset-0 pointer-events-none sm:dot-grid-bg"
        style={{
          backgroundImage: "radial-gradient(circle, oklch(1 0 0 / 8%) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Prism container */}
      <div className="relative w-full max-w-md sm:max-w-4xl mx-auto">
        {/* SVG triangle + beams */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible hidden sm:block"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            {/* Clip beams to stay fully outside the triangle */}
            <clipPath id="outside-left">
              <rect x="-40" y="0" width="55" height="100" />
            </clipPath>
            <clipPath id="outside-right">
              <rect x="60" y="0" width="80" height="100" />
            </clipPath>
            <linearGradient id="prism-edge-bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="prism-glass-bg" x1="0.5" y1="0" x2="0.5" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0.04" />
              <stop offset="100%" stopColor="white" stopOpacity="0.015" />
            </linearGradient>
          </defs>

          {/* Triangle */}
          <polygon
            points="50,0 2,100 98,100"
            fill="url(#prism-glass-bg)"
            stroke="url(#prism-edge-bg)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />

          {/* Left beams */}
          <g clipPath="url(#outside-left)">
            {LEFT_BEAMS.map((beam, i) => (
              <line
                key={`l${i}`}
                x1={beam.x1} y1={beam.y1}
                x2={beam.x2} y2={beam.y2}
                stroke={beam.color}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                className="animate-beam-out"
                style={{ animationDelay: `${beam.delay}s` }}
              />
            ))}
          </g>

          {/* Right beams */}
          <g clipPath="url(#outside-right)">
            {RIGHT_BEAMS.map((beam, i) => (
              <line
                key={`r${i}`}
                x1={beam.x1} y1={beam.y1}
                x2={beam.x2} y2={beam.y2}
                stroke={beam.color}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                className="animate-beam-out"
                style={{ animationDelay: `${beam.delay}s` }}
              />
            ))}
          </g>
        </svg>

        {/* Content inside the prism */}
        <div className="relative flex flex-col items-center gap-6 sm:gap-5 py-8 sm:pt-36 sm:pb-18 px-6 sm:px-32">
          {/* Title */}
          <h1
            className="relative text-5xl sm:text-7xl font-bold font-mono tracking-tighter bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent opacity-0 animate-hero-fade-in"
            style={{ animationDelay: "100ms" }}
          >
            <span className="absolute inset-0 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent blur-xl opacity-60" aria-hidden="true">Prism</span>
            Prism
          </h1>

          {/* Subtitle */}
          <p
            className="text-sm sm:text-base text-muted-foreground font-light max-w-sm opacity-0 animate-hero-fade-in"
            style={{ animationDelay: "200ms" }}
          >
            One question, many angles. An AI agent refracts your question
            through multiple lenses to reveal hidden connections and insights.
          </p>

          {/* Input area */}
          <form
            onSubmit={handleSubmit}
            className="flex w-full max-w-md gap-3 mt-2 sm:mt-1 opacity-0 animate-hero-fade-in flex-col sm:flex-row"
            style={{ animationDelay: "300ms" }}
          >
            <Input
              placeholder="What question do you want to explore?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="flex-1 h-11 px-4 text-sm bg-card/50 border-border/50 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/40 transition-shadow"
            />
            <Button
              type="submit"
              disabled={question.trim().length < 5}
              className="h-11 px-5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-medium transition-all"
            >
              Explore
            </Button>
          </form>
        </div>
      </div>

    </section>
  );
}
