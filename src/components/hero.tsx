"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SUGGESTIONS = [
  "Why do civilizations collapse?",
  "How does music affect the brain?",
  "What makes a city walkable?",
  "Is consciousness computable?",
];

const ORBS = [
  { color: "oklch(0.7 0.15 270)",  size: 180, top: "15%", left: "12%",  blur: 80,  duration: 22 },
  { color: "oklch(0.75 0.15 85)",  size: 140, top: "60%", left: "75%",  blur: 70,  duration: 26 },
  { color: "oklch(0.7 0.15 160)",  size: 120, top: "25%", left: "80%",  blur: 60,  duration: 30 },
  { color: "oklch(0.7 0.15 25)",   size: 100, top: "70%", left: "20%",  blur: 60,  duration: 24 },
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
    <section className="relative flex flex-col items-center text-center py-24 sm:py-32 px-4 overflow-hidden">
      {/* Dot grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, oklch(1 0 0 / 8%) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black, transparent)",
          WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black, transparent)",
        }}
      />

      {/* Floating orbs */}
      {ORBS.map((orb, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none animate-float-orb"
          style={{
            width: orb.size,
            height: orb.size,
            top: orb.top,
            left: orb.left,
            background: `radial-gradient(circle, ${orb.color}, transparent 70%)`,
            filter: `blur(${orb.blur}px)`,
            opacity: 0.35,
            animationDuration: `${orb.duration}s`,
            animationDelay: `${i * -5}s`,
          }}
        />
      ))}

      {/* Top gradient line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(600px,80%)] h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

      {/* Content */}
      <div className="relative flex flex-col items-center gap-5">
        {/* Label badge */}
        <span
          className="inline-block text-[10px] sm:text-xs font-semibold tracking-[0.2em] uppercase text-indigo-400/80 border border-indigo-500/20 rounded-full px-4 py-1.5 backdrop-blur-sm opacity-0 animate-hero-fade-in"
          style={{ animationDelay: "0ms" }}
        >
          Explore Ideas With AI
        </span>

        {/* Title */}
        <h1
          className="text-6xl sm:text-7xl font-bold font-mono tracking-tighter bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent opacity-0 animate-hero-fade-in"
          style={{ animationDelay: "100ms" }}
        >
          Prism
        </h1>

        {/* Subtitle */}
        <p
          className="text-base sm:text-lg text-muted-foreground font-light max-w-md opacity-0 animate-hero-fade-in"
          style={{ animationDelay: "200ms" }}
        >
          Enter a question. Watch an AI agent decompose it into lenses, discover
          connections, and synthesize insights in real time.
        </p>

        {/* Input area */}
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-xl gap-2 mt-2 opacity-0 animate-hero-fade-in"
          style={{ animationDelay: "300ms" }}
        >
          <Input
            placeholder="What question do you want to explore?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="flex-1 h-12 px-5 text-base bg-card/50 border-border/50 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/40 transition-shadow"
          />
          <Button
            type="submit"
            disabled={question.trim().length < 5}
            className="h-12 px-6 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-medium transition-all"
          >
            Explore
          </Button>
        </form>

        {/* Suggestion chips */}
        <div
          className="flex flex-wrap justify-center gap-2 max-w-xl opacity-0 animate-hero-fade-in"
          style={{ animationDelay: "450ms" }}
        >
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQuestion(s)}
              className="text-xs text-muted-foreground hover:text-foreground border border-border/50 hover:border-border rounded-full px-3 py-1.5 transition-colors backdrop-blur-sm"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom gradient line */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[min(600px,80%)] h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />
    </section>
  );
}
