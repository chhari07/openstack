// Reader mode for the website. The Android app does the same work on the
// phone (see lib/article-native.ts).
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import sanitizeHtml from "sanitize-html";
import { absolute, ALLOWED_TAGS, getArticle, isStoryId, type HtmlTools } from "@/lib/article";

const tools: HtmlTools = {
  readable(page) {
    const { document } = parseHTML(page);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = new Readability(document as any).parse();
    if (!parsed?.content || (parsed.textContent ?? "").trim().length < 400) return null;
    return {
      html: parsed.content,
      byline: parsed.byline ?? undefined,
      title: parsed.title ?? undefined,
      published: parsed.publishedTime ?? undefined,
    };
  },
  ogImage(page) {
    const { document } = parseHTML(page);
    return document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? undefined;
  },
  clean(html, base) {
    return sanitizeHtml(html, {
      allowedTags: ALLOWED_TAGS,
      allowedAttributes: { a: ["href"], img: ["src", "alt"] },
      allowedSchemes: ["http", "https"],
      transformTags: {
        h1: "h2",
        a: (tagName, attribs) => ({
          tagName,
          attribs: {
            href: absolute(attribs.href, base) ?? "#",
            target: "_blank",
            rel: "noopener noreferrer",
          },
        }),
        img: (tagName, attribs) => ({
          tagName,
          attribs: { src: absolute(attribs.src, base) ?? "", alt: attribs.alt ?? "", loading: "lazy" },
        }),
      },
      exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
    });
  },
};

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!isStoryId(id)) return Response.json({ error: "Bad id" }, { status: 400 });
  const article = await getArticle(id, tools);
  if (!article) return Response.json({ error: "Story not found" }, { status: 404 });
  return Response.json(article);
}
