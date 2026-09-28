"use client";

// Draws saved highlights back onto text using the CSS Custom Highlight API.
// Text can be split across many nodes (the PDF text layer puts every line in
// its own span), so we join all text nodes, search the joined string, then
// map the match back to a DOM Range.

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

function findRange(root: Node, quote: string): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; start: number }[] = [];
  let text = "";
  // Build a whitespace-collapsed copy of the text and remember where each
  // collapsed character came from.
  const map: { node: Text; offset: number }[] = [];
  let lastWasSpace = true;
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    nodes.push({ node: n, start: text.length });
    const value = n.data;
    for (let i = 0; i < value.length; i++) {
      const isSpace = /\s/.test(value[i]);
      if (isSpace && lastWasSpace) continue;
      text += isSpace ? " " : value[i];
      map.push({ node: n, offset: i });
      lastWasSpace = isSpace;
    }
    // Neighbouring spans in a PDF often have no space between lines.
    if (!lastWasSpace) {
      text += " ";
      map.push({ node: n, offset: value.length });
      lastWasSpace = true;
    }
  }
  const q = norm(quote);
  if (!q) return null;
  const at = text.indexOf(q);
  if (at < 0) return null;
  const start = map[at];
  const end = map[at + q.length - 1];
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, Math.min(end.offset + 1, end.node.length));
  return range;
}

export function paintHighlights(name: string, root: Node | null, quotes: string[]) {
  if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
  if (!root) {
    CSS.highlights.delete(name);
    return;
  }
  const ranges = quotes.map((q) => findRange(root, q)).filter((r): r is Range => r !== null);
  CSS.highlights.set(name, new Highlight(...ranges));
}
