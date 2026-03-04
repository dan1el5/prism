# Prism — Project Specification

## Overview

Prism is a web app where an AI agent autonomously explores a question. The user enters a question, then watches the agent decompose it into lenses, discover concepts, find cross-domain connections, and produce a structured knowledge map with synthesis. The agent's trace is the UI — every stage of reasoning is visible.

## Agent Architecture

The agent runs 4 stages per exploration, each a separate Claude API call with structured JSON output:

### Stage 1 — Decompose
- Input: user's question
- Output: 3-4 lenses (angles to explore the question from)

### Stage 2 — Explore (runs once per lens, parallelized)
- Input: original question + one lens
- Output: 3-5 concepts per lens, each with name, description, key thinkers, and relevance

### Stage 3 — Connect
- Input: all concepts from all lenses
- Output: cross-domain connections — pairs of concepts with descriptions of why they're related

### Stage 4 — Synthesize
- Input: question + all concepts + all connections
- Output: written synthesis — key tensions, emerging patterns, open questions

Haiku for stages 1-3, Sonnet for stage 4.

## Data Model

No database. Pre-baked explorations are static JSON in `/public/explorations/`. Live explorations exist only in memory during the SSE stream and in client state.

Core types are defined in `src/lib/types.ts`.

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/explorations` | GET | List pre-baked explorations (metadata) |
| `/api/explorations/[id]` | GET | Full exploration data (pre-baked) |
| `/api/explore` | POST | Start live exploration, returns SSE stream |
| `/api/rate-limit` | GET | Check remaining live runs for visitor |

### SSE Event Types
```
status      → { stage: "decompose" | "explore" | "connect" | "synthesize" }
lenses      → Lens[]
concepts    → { lensId: string, concepts: Concept[] }
connections → Connection[]
synthesis   → { content: string }
done        → {}
error       → { message: string }
```

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Graph:** React Flow with dagre layout
- **AI:** Anthropic TypeScript SDK (direct API, no wrappers)
- **Streaming:** Server-Sent Events
- **Rate Limiting:** In-memory (5 live explorations per IP per day)
- **Hosting:** Vercel

## UI Structure

**Landing (`/`)** — Hero with gradient text, input field, pre-baked exploration cards.

**Exploration (`/explore/[id]`)** — Left panel: agent trace with progress bar and timeline. Right panel: React Flow knowledge graph with animated nodes. Bottom: synthesis card with gradient border.

Pre-baked explorations use progressive reveal (`useProgressiveReveal`) to animate the agent trace as if running live. A "Skip animation" button allows jumping to the full result.

## Design

Dark theme with blue-tinted palette. Lens-colored graph nodes with glow effects. Keyframe animations for node entry, content fade-in, and edge drawing.
