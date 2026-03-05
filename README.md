# Prism

A multi-stage AI agent that autonomously explores questions — decomposing them into lenses, discovering concepts across domains, surfacing non-obvious connections, and synthesizing insights. The agent's reasoning trace is the interface.

**[Live Demo →](prism-nine-ebon.vercel.app)**

## Architecture

The agent executes four stages per exploration, each a discrete Claude API call returning structured JSON:

| Stage | Input | Output |
|-------|-------|--------|
| **Decompose** | User's question | 3-4 lenses (exploration angles) |
| **Explore** | Question + lens (parallelized) | 3-5 concepts per lens with key thinkers |
| **Connect** | All concepts across lenses | Cross-domain connection pairs with rationale |
| **Synthesize** | Full concept graph | Written synthesis of tensions, patterns, open questions |

Results stream to the client via SSE as the agent completes each stage. The left panel renders the agent trace in real time. The right panel incrementally builds a knowledge graph — nodes are concepts (color-coded by lens), edges are discovered connections.

Pre-baked explorations replay through a progressive reveal system that animates the same stage-by-stage experience without API calls.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · React Flow · Anthropic SDK · SSE

## Design Decisions

- **No database** — pre-baked explorations are static JSON, live explorations exist only in the SSE stream and client state
- **No chat interface** — this is an autonomous agent, not a conversational assistant. The user submits a question and watches the agent work
- **Structured outputs throughout** — every stage returns typed JSON, not prose. The knowledge graph is an artifact built across multiple reasoning steps
- **Haiku for stages 1-3, Sonnet for synthesis** — optimizes for speed during exploration, quality during final output
