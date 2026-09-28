import { getNews, isTopic } from "@/lib/news";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const param = params.get("topic") ?? "top";
  const topic = isTopic(param) ? param : "top";
  // ?fresh=1 (pull to refresh) goes to the sources instead of the cache.
  const fresh = params.get("fresh") === "1";
  const stories = await getNews(topic, fresh);
  return Response.json(
    { topic, stories },
    {
      headers: {
        "cache-control": fresh
          ? "no-store"
          : "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
