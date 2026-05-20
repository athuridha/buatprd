"use client";

import { useEffect, useRef, useState, memo } from "react";

interface MermaidRendererProps {
  chart: string;
}

/**
 * Sanitize mermaid chart syntax for v11 compatibility:
 * - Quote node labels that contain special characters
 * - Fix common AI-generated syntax issues
 */
function sanitizeMermaidChart(raw: string): string {
  let chart = raw.trim();

  // Remove any leading/trailing markdown code fence artifacts
  chart = chart.replace(/^```mermaid\s*/i, "").replace(/```\s*$/, "").trim();

  // Fix sequenceDiagram and erDiagram issues:
  let inErDiagram = false;
  const lines = chart.split("\n");
  
  const fixedLines = lines.map((line) => {
    const trimmed = line.trim();

    // Context tracking
    if (trimmed.startsWith('erDiagram')) inErDiagram = true;
    if (/^(sequenceDiagram|flowchart|graph|classDiagram|pie|gantt|stateDiagram|gitgraph)/.test(trimmed)) {
      inErDiagram = false;
    }

    // Skip empty lines
    if (!trimmed) return line;

    // erDiagram fixes: remove parenthesis in types (e.g. varchar(255) -> varchar255)
    // and replace dashes with underscores in field names.
    if (inErDiagram && !trimmed.startsWith('erDiagram')) {
      // If it's a field definition line (inside { }, no relationship arrows)
      if (!trimmed.includes('{') && !trimmed.includes('}') && !trimmed.includes('--')) {
        let fixedField = line.replace(/[()]/g, ''); // varchar(255) -> varchar255
        fixedField = fixedField.replace(/-/g, '_'); // created-at -> created_at
        return fixedField;
      }
      // If it's a table name definition with a dash (e.g. user-profiles { )
      if (trimmed.includes('{') && trimmed.includes('-')) {
        return line.replace(/([a-zA-Z0-9]+)-([a-zA-Z0-9]+)/g, '$1_$2');
      }
    }

    // For sequenceDiagram: fix "participant X as Label With Special (Chars)"
    // The label part after "as" needs quoting if it has parens/brackets
    if (/^participant\s+/.test(trimmed)) {
      const asMatch = trimmed.match(/^(participant\s+\S+\s+as\s+)(.+)$/);
      if (asMatch) {
        const label = asMatch[2];
        if (/[()[\]{}#&;]/.test(label) && !label.startsWith('"')) {
          return `${asMatch[1]}"${label}"`;
        }
      }
      return line;
    }

    // For flowchart: fix direct quoted nodes like: A --> "Some Label"
    if (!inErDiagram && (line.includes('-->') || line.includes('-.->') || line.includes('->'))) {
      // Fix left side: "Some Label" --> B
      line = line.replace(/"([^"]+)"\s*(->|-->|-\.->)/g, (match, label, arrow) => {
        const id = label.replace(/[^a-zA-Z0-9]/g, '_');
        return `${id}["${label}"] ${arrow}`;
      });
      
      // Fix right side: A --> "Some Label" or A -.->|text| "Some Label"
      line = line.replace(/(->|-->|-\.->)(?:\|[^|]+\|)?\s*"([^"]+)"/g, (match, arrow, label) => {
        const id = label.replace(/[^a-zA-Z0-9]/g, '_');
        // We only want to replace the `"label"` part at the end of the match
        return match.replace(`"${label}"`, `${id}["${label}"]`);
      });
    }

    // For Note blocks: quote content with special chars
    if (/^Note\s/.test(trimmed)) {
      const noteMatch = trimmed.match(/^(Note\s+(?:over|left of|right of)\s+[^:]+:\s*)(.+)$/i);
      if (noteMatch) {
        const content = noteMatch[2];
        if (/[()[\]{}#&;]/.test(content) && !content.startsWith('"')) {
          return `${noteMatch[1]}"${content}"`;
        }
      }
      return line;
    }

    // For flowchart: fix node labels like A[Label (with parens)] -> A["Label (with parens)"]
    // Match patterns like: ID[some label] or ID(some label) or ID{some label}
    const flowNodeMatch = trimmed.match(/^(\s*\w+)(\[)([^\]"]+)(\])/);
    if (flowNodeMatch) {
      const label = flowNodeMatch[3];
      if (/[(){}#&;]/.test(label)) {
        return line.replace(flowNodeMatch[0], `${flowNodeMatch[1]}["${label}"]`);
      }
    }

    return line;
  });

  return fixedLines.join("\n");
}

const MermaidRenderer = memo(function MermaidRenderer({
  chart,
}: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    // Don't try to render incomplete/empty charts
    const trimmed = chart.trim();
    if (!trimmed || trimmed.length < 10) {
      return;
    }

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          suppressErrorRendering: true,
          themeVariables: {
            primaryColor: "#10b981",
            primaryTextColor: "#fafafa",
            primaryBorderColor: "#27272a",
            lineColor: "#3f3f46",
            secondaryColor: "#18181b",
            tertiaryColor: "#09090b",
            noteBkgColor: "#1a1a1f",
            noteTextColor: "#a1a1aa",
            actorBkg: "#18181b",
            actorBorder: "#10b981",
            actorTextColor: "#fafafa",
            signalColor: "#a1a1aa",
          },
          fontFamily: "Geist, ui-sans-serif, sans-serif",
          fontSize: 14,
          flowchart: {
            curve: 'step',
          },
          state: {
            curve: 'step',
          }
        } as any);

        const sanitized = sanitizeMermaidChart(trimmed);
        const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;

        // Validate first
        const isValid = await mermaid.parse(sanitized, { suppressErrors: true }).catch(() => false);

        if (!isValid) {
          // Try a second pass: more aggressive sanitization
          // Strip out problem characters entirely that usually break Mermaid v11
          const aggressive = sanitized
            .replace(/[“”]/g, '"')  // Fix smart quotes
            .replace(/[‘’]/g, "'") // Fix smart apostrophes
            .replace(/&/g, " and ") // Replace & with "and"
            .replace(/\t/g, "    ") // Replace tabs
            .split('\n')
            .map(line => {
              if (line.trim().startsWith('participant') || line.trim().startsWith('Note')) return line;
              if (line.includes('erDiagram') || line.includes('{') || line.includes('}')) return line;
              // Strip parens and brackets from regular lines (like sequence messages) if they aren't part of flowcharts
              if (line.includes('->>')) {
                return line.replace(/[()[\]{}]/g, '');
              }
              return line;
            })
            .join('\n');

          const isValid2 = await mermaid.parse(aggressive, { suppressErrors: true }).catch(() => false);

          if (!isValid2) {
            // Third pass: extremely aggressive. Remove almost all non-alphanumeric from message parts
            const ultraAggressive = aggressive.split('\n').map(line => {
               if (line.includes('->>')) {
                 const parts = line.split(':');
                 if (parts.length > 1) {
                   const cleanMsg = parts.slice(1).join(':').replace(/[^a-zA-Z0-9\s,.-]/g, '');
                   return `${parts[0]}: ${cleanMsg}`;
                 }
               }
               // ER diagram field fixes (remove dashes)
               if (line.trim().match(/^[a-zA-Z0-9_]+\s+[a-zA-Z0-9_-]+$/)) {
                 return line.replace(/-/g, '_');
               }
               return line;
            }).join('\n');
            
            const isValid3 = await mermaid.parse(ultraAggressive, { suppressErrors: true }).catch(() => false);

            if (!isValid3) {
              if (!cancelled) {
                setError(true);
                setErrorMsg("Diagram syntax not valid for Mermaid v11");
              }
              return;
            }
            
            const { svg: renderedSvg } = await mermaid.render(id, ultraAggressive);
            if (!cancelled) {
              setSvg(renderedSvg);
              setError(false);
            }
            return;
          }

          const { svg: renderedSvg } = await mermaid.render(id, aggressive);
          if (!cancelled) {
            setSvg(renderedSvg);
            setError(false);
          }
          return;
        }

        const { svg: renderedSvg } = await mermaid.render(id, sanitized);
        if (!cancelled) {
          setSvg(renderedSvg);
          setError(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(true);
          setErrorMsg(err instanceof Error ? err.message : "Render failed");
        }
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return (
      <div className="rounded-xl bg-surface-1 border border-border p-4 my-4">
        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Diagram ditampilkan sebagai kode (Mermaid syntax issue)</span>
        </div>
        <pre className="text-sm font-mono text-muted overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {chart.trim()}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="rounded-xl bg-surface-1 border border-border p-6 my-4 flex items-center justify-center print:bg-[#18181b] print:border-[#27272a]">
        <div className="shimmer h-32 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container rounded-xl bg-surface-1 border border-border p-4 my-4 overflow-x-auto print:bg-[#18181b] print:border-[#27272a]"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});

export default MermaidRenderer;
