// Lightweight markdown renderer for React Native.
// Handles: bold, italic, code, inline code, headers, lists, links, tables, mermaid diagrams.

import React from "react";
import { Text, View, ScrollView } from "react-native";
import { useColorScheme } from "nativewind";

interface Props {
  children: string;
}

interface Segment {
  type: "bold" | "italic" | "code" | "text" | "link";
  content: string;
  href?: string;
}

function parseInline(text: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }
    if (match[2]) {
      segments.push({ type: "bold", content: match[2] });
    } else if (match[3]) {
      segments.push({ type: "italic", content: match[3] });
    } else if (match[4]) {
      segments.push({ type: "code", content: match[4] });
    } else if (match[5] && match[6]) {
      segments.push({ type: "link", content: match[5], href: match[6] });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ type: "text", content: text }];
}

function renderSegments(segments: Segment[], baseStyle: any, isDark: boolean) {
  return segments.map((seg, i) => {
    switch (seg.type) {
      case "bold":
        return (
          <Text key={i} style={[baseStyle, { fontWeight: "700" }]}>
            {seg.content}
          </Text>
        );
      case "italic":
        return (
          <Text key={i} style={[baseStyle, { fontStyle: "italic" }]}>
            {seg.content}
          </Text>
        );
      case "code":
        return (
          <Text
            key={i}
            style={[
              baseStyle,
              {
                backgroundColor: isDark ? "#374151" : "#f3f4f6",
                borderRadius: 4,
                paddingHorizontal: 4,
                fontFamily: "monospace",
                fontSize: 13,
              },
            ]}
          >
            {seg.content}
          </Text>
        );
      case "link":
        return (
          <Text
            key={i}
            style={[
              baseStyle,
              {
                color: isDark ? "#c084fc" : "#7e22ce",
                textDecorationLine: "underline",
              },
            ]}
          >
            {seg.content}
          </Text>
        );
      default:
        return (
          <Text key={i} style={baseStyle}>
            {seg.content}
          </Text>
        );
    }
  });
}

// Parse a markdown table row into cells
function parseTableRow(line: string): string[] {
  return line
    .split("|")
    .map((c) => c.trim())
    .filter((c, i, arr) => i > 0 && i < arr.length - 1);
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function isTableRow(line: string): boolean {
  return /^\|.+\|$/.test(line.trim()) && !isTableSeparator(line);
}

function isMermaidStart(line: string): boolean {
  return line.trim() === "```mermaid" || line.trim() === "```mermaid";
}

// Table rendering component
function MarkdownTable({
  headers,
  rows,
  isDark,
  baseStyle,
}: {
  headers: string[];
  rows: string[][];
  isDark: boolean;
  baseStyle: any;
}) {
  const borderColor = isDark ? "#374151" : "#e5e7eb";
  const headerBg = isDark ? "#1f2937" : "#f3f4f6";
  const cellPad = 8;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginVertical: 8 }}
    >
      <View
        style={{
          borderWidth: 1,
          borderColor,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {/* Header row */}
        {headers.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              backgroundColor: headerBg,
              borderBottomWidth: 1,
              borderColor,
            }}
          >
            {headers.map((h, i) => (
              <View
                key={`h-${i}`}
                style={{
                  padding: cellPad,
                  minWidth: 80,
                  borderRightWidth: i < headers.length - 1 ? 1 : 0,
                  borderColor,
                }}
              >
                <Text
                  style={[
                    baseStyle,
                    { fontWeight: "700", fontSize: 13, color: isDark ? "#c084fc" : "#7e22ce" },
                  ]}
                  numberOfLines={2}
                >
                  {h}
                </Text>
              </View>
            ))}
          </View>
        )}
        {/* Data rows */}
        {rows.map((row, ri) => (
          <View
            key={`r-${ri}`}
            style={{
              flexDirection: "row",
              borderBottomWidth: ri < rows.length - 1 ? 1 : 0,
              borderColor,
              backgroundColor: ri % 2 === 0 ? "transparent" : isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
            }}
          >
            {row.map((cell, ci) => (
              <View
                key={`c-${ri}-${ci}`}
                style={{
                  padding: cellPad,
                  minWidth: 80,
                  borderRightWidth: ci < row.length - 1 ? 1 : 0,
                  borderColor,
                }}
              >
                <Text style={[baseStyle, { fontSize: 13 }]} numberOfLines={3}>
                  {renderSegments(parseInline(cell), baseStyle, isDark)}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// Mermaid diagram placeholder
function MermaidBlock({
  content,
  isDark,
}: {
  content: string;
  isDark: boolean;
}) {
  return (
    <View
      style={{
        marginVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: isDark ? "#374151" : "#e5e7eb",
        backgroundColor: isDark ? "#111827" : "#f9fafb",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderBottomWidth: 1,
          borderColor: isDark ? "#374151" : "#e5e7eb",
          backgroundColor: isDark ? "#1f2937" : "#f3f4f6",
        }}
      >
        <Text style={{ fontSize: 12, color: isDark ? "#9ca3af" : "#6b7280" }}>
          Flowchart
        </Text>
      </View>
      <View style={{ padding: 10 }}>
        <Text
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            color: isDark ? "#9ca3af" : "#6b7280",
            lineHeight: 18,
          }}
        >
          {content.trim()}
        </Text>
      </View>
    </View>
  );
}

export function SimpleMarkdown({ children }: Props) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const baseStyle = isDark
    ? { color: "#e5e7eb", fontSize: 14, lineHeight: 20 }
    : { color: "#1f2937", fontSize: 14, lineHeight: 20 };

  const lines = children.split("\n");
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <View
          key={`list-${elements.length}`}
          style={{ marginLeft: 4, marginBottom: 4 }}
        >
          {listItems.map((item, j) => (
            <Text key={j} style={{ ...baseStyle, flexDirection: "row" }}>
              {"\u2022 "}
              {renderSegments(
                parseInline(item.replace(/^\s*[-*]\s*/, "")),
                baseStyle,
                isDark,
              )}
            </Text>
          ))}
        </View>,
      );
      listItems = [];
    }
    inList = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <Text
          key={i}
          style={{
            ...baseStyle,
            fontWeight: "700",
            fontSize: 15,
            marginTop: 6,
            marginBottom: 2,
          }}
        >
          {line.slice(4)}
        </Text>,
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <Text
          key={i}
          style={{
            ...baseStyle,
            fontWeight: "700",
            fontSize: 16,
            marginTop: 8,
            marginBottom: 2,
          }}
        >
          {line.slice(3)}
        </Text>,
      );
      continue;
    }
    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <Text
          key={i}
          style={{
            ...baseStyle,
            fontWeight: "700",
            fontSize: 18,
            marginTop: 8,
            marginBottom: 4,
          }}
        >
          {line.slice(2)}
        </Text>,
      );
      continue;
    }

    // Lists
    if (/^\s*[-*]\s/.test(line)) {
      inList = true;
      listItems.push(line);
      continue;
    }
    if (/^\s*\d+\.\s/.test(line)) {
      inList = true;
      listItems.push(line);
      continue;
    }

    // Mermaid diagrams
    if (isMermaidStart(line)) {
      flushList();
      const mermaidLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        mermaidLines.push(lines[i]);
        i++;
      }
      elements.push(
        <MermaidBlock
          key={`mermaid-${elements.length}`}
          content={mermaidLines.join("\n")}
          isDark={isDark}
        />,
      );
      continue;
    }

    // Code blocks
    if (line.startsWith("```")) {
      flushList();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <ScrollView
          key={`code-${elements.length}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{
            backgroundColor: isDark ? "#1f2937" : "#f3f4f6",
            borderRadius: 6,
            padding: 8,
            marginBottom: 4,
          }}
        >
          <Text
            style={{
              fontFamily: "monospace",
              fontSize: 13,
              color: isDark ? "#e5e7eb" : "#1f2937",
            }}
          >
            {codeLines.join("\n")}
          </Text>
        </ScrollView>,
      );
      continue;
    }

    // Table detection
    if (isTableRow(line)) {
      flushList();
      const headerCells = parseTableRow(line);
      const dataRows: string[][] = [];

      // Check next line for separator
      if (i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        i += 2; // skip separator
        // Collect data rows
        while (i < lines.length && isTableRow(lines[i])) {
          dataRows.push(parseTableRow(lines[i]));
          i++;
        }
        i--; // back one since loop will increment

        elements.push(
          <MarkdownTable
            key={`table-${elements.length}`}
            headers={headerCells}
            rows={dataRows}
            isDark={isDark}
            baseStyle={baseStyle}
          />,
        );
        continue;
      }
    }

    // Empty lines
    if (line.trim() === "") {
      flushList();
      elements.push(<View key={i} style={{ height: 4 }} />);
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <Text key={i} style={baseStyle}>
        {renderSegments(parseInline(line), baseStyle, isDark)}
      </Text>,
    );
  }
  flushList();

  return <View>{elements}</View>;
}