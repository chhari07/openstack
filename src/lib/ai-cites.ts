// Page references the model writes: "(p. 4)", "(pp. 7–8)", "(p. 3, p. 4)",
// "(p. 87, 274)", "(page 12)", "(pages 3 and 5)". Each becomes a page link
// (the first page of a range) and the marker is taken out of the text.
export function pageRefs(text: string, onPage: (page: number) => void) {
  return text.replace(/\s?\((\s*(?:pp?\.|pages?)\s*\d[^()]*)\)/gi, (whole, inside: string) => {
    // Only if the brackets hold nothing but page numbers.
    if (!/^[\s\d,;–—&-]*$/.test(inside.replace(/pp?\.|pages?|and/gi, ""))) return whole;
    for (const m of inside.matchAll(/(\d{1,4})(?:\s*[–—-]\s*\d{1,4})?/g)) onPage(Number(m[1]));
    return "";
  });
}
