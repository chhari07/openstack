"use client";

// Reader mode inside the Android app, where there's no server. Capacitor's
// native HTTP (CapacitorHttp) makes these fetches without browser CORS limits.
import { Readability } from "@mozilla/readability";
import DOMPurify from "dompurify";
import { absolute, ALLOWED_TAGS, getArticle, type HtmlTools } from "./article";

// DOMParser documents are inert: no scripts run and no images load.
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

const tools: HtmlTools = {
  readable(page) {
    const parsed = new Readability(parse(page)).parse();
    if (!parsed?.content || (parsed.textContent ?? "").trim().length < 400) return null;
    return {
      html: parsed.content,
      byline: parsed.byline ?? undefined,
      title: parsed.title ?? undefined,
      published: parsed.publishedTime ?? undefined,
    };
  },
  ogImage(page) {
    return parse(page).querySelector('meta[property="og:image"]')?.getAttribute("content") ?? undefined;
  },
  ogTitle(page) {
    const doc = parse(page);
    const t = doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? doc.title;
    return t?.trim() || undefined;
  },
  clean(html, base) {
    const frag = DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR: ["href", "src", "alt"],
      RETURN_DOM_FRAGMENT: true,
    });
    frag.querySelectorAll("a").forEach((a) => {
      a.setAttribute("href", absolute(a.getAttribute("href"), base) ?? "#");
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });
    frag.querySelectorAll("img").forEach((img) => {
      const src = absolute(img.getAttribute("src"), base);
      if (!src) return img.remove();
      img.setAttribute("src", src);
      img.setAttribute("loading", "lazy");
    });
    const box = document.createElement("div");
    box.append(frag);
    return box.innerHTML;
  },
};

export const getArticleNative = (id: string) => getArticle(id, tools, true);
