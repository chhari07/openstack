import { getNews, isTopic } from "@/lib/news";

export async function GET(request: Request) {
  const param = new URL(request.url).searchParams.get("topic") ?? "top";
  const topic = isTopic(param) ? param : "top";
  const stories = await getNews(topic);
  return Response.json(
    { topic, stories },
    { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
