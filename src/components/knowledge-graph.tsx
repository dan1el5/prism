"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { Exploration, Concept } from "@/lib/types";
import { NodeDetail } from "./node-detail";

const LENS_COLORS: { bg: string; border: string; text: string }[] = [
  { bg: "rgba(99, 102, 241, 0.15)", border: "#818cf8", text: "#c7d2fe" },   // indigo
  { bg: "rgba(245, 158, 11, 0.15)", border: "#fbbf24", text: "#fde68a" },    // amber
  { bg: "rgba(16, 185, 129, 0.15)", border: "#34d399", text: "#a7f3d0" },    // emerald
  { bg: "rgba(239, 68, 68, 0.15)", border: "#f87171", text: "#fecaca" },     // red
  { bg: "rgba(139, 92, 246, 0.15)", border: "#a78bfa", text: "#ddd6fe" },    // violet
];

function ConceptNode({ data }: NodeProps<Node<{ label: string; color: typeof LENS_COLORS[number]; concept: Concept; animate: boolean }>>) {
  return (
    <div
      className={`px-4 py-3 rounded-xl border shadow-lg text-xs font-medium max-w-[180px] text-center cursor-pointer transition-shadow hover:shadow-xl ${data.animate ? "animate-node-enter" : ""}`}
      style={{
        borderColor: data.color.border,
        backgroundColor: data.color.bg,
        color: data.color.text,
        boxShadow: `0 0 12px ${data.color.border}33`,
      }}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

const nodeTypes = { concept: ConceptNode };

function layoutGraph(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 70, ranksep: 90 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 180, height: 56 });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: { x: pos.x - 90, y: pos.y - 28 },
    };
  });
}

export function KnowledgeGraph({
  exploration,
}: {
  exploration: Exploration;
}) {
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const animatedNodesRef = useRef<Set<string>>(new Set());

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    exploration.lenses.forEach((lens, lensIdx) => {
      const color = LENS_COLORS[lensIdx % LENS_COLORS.length];
      lens.concepts.forEach((concept) => {
        const shouldAnimate = !animatedNodesRef.current.has(concept.id);
        if (shouldAnimate) {
          animatedNodesRef.current.add(concept.id);
        }
        nodes.push({
          id: concept.id,
          type: "concept",
          position: { x: 0, y: 0 },
          data: { label: concept.name, color, concept, animate: shouldAnimate },
        });
      });
    });

    exploration.connections.forEach((conn) => {
      edges.push({
        id: conn.id,
        source: conn.sourceConceptId,
        target: conn.targetConceptId,
        label: "",
        style: {
          stroke: "#6366f1",
          strokeWidth: 2,
          strokeDasharray: "6 3",
        },
        animated: true,
      });
    });

    const laid = nodes.length > 0 ? layoutGraph(nodes, edges) : nodes;
    return { initialNodes: laid, initialEdges: edges };
  }, [exploration.lenses, exploration.connections]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const concept = (node.data as { concept: Concept }).concept;
      setSelectedConcept(concept);
    },
    []
  );

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Concepts will appear here as the agent discovers them...
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#333" gap={20} />
        <Controls />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute top-2 right-2 bg-card/80 backdrop-blur-sm rounded-lg p-2.5 text-xs space-y-1.5 border border-border/50">
        {exploration.lenses.map((lens, i) => (
          <div key={lens.id} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: LENS_COLORS[i % LENS_COLORS.length].border }}
            />
            <span className="text-muted-foreground">{lens.name}</span>
          </div>
        ))}
      </div>

      {selectedConcept && (
        <NodeDetail
          concept={selectedConcept}
          connections={exploration.connections.filter(
            (c) =>
              c.sourceConceptId === selectedConcept.id ||
              c.targetConceptId === selectedConcept.id
          )}
          allConcepts={exploration.lenses.flatMap((l) => l.concepts)}
          onClose={() => setSelectedConcept(null)}
        />
      )}
    </div>
  );
}
