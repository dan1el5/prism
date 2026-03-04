"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <section className="relative flex flex-col items-center gap-6 text-center py-20 px-4 overflow-hidden">
      {/* Background glow orb */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] rounded-full opacity-30 blur-[100px] pointer-events-none"
        style={{
          background: "radial-gradient(circle, oklch(0.55 0.2 270), oklch(0.5 0.15 300), transparent)",
        }}
      />

      <h1 className="relative text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
        Prism
      </h1>
      <p className="relative text-lg text-muted-foreground max-w-xl">
        Enter a question. Watch an AI agent decompose it into lenses, discover
        concepts, find cross-domain connections, and synthesize insights — all
        in real time.
      </p>
      <form
        onSubmit={handleSubmit}
        className="relative flex w-full max-w-lg gap-2 mt-4"
      >
        <Input
          placeholder="What question do you want to explore?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="flex-1 bg-card/50 border-border/50 backdrop-blur-sm"
        />
        <Button type="submit" disabled={question.trim().length < 5}>
          Explore
        </Button>
      </form>
    </section>
  );
}
