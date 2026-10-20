import json
import uuid

import httpx
from fastapi import APIRouter, Query

from app.models import ChatRequest, ChatResponse
from app import config

router = APIRouter()


SYSTEM_INSTRUCTION = (
    "You are Foodie AI, a warm, concise food assistant for the Fooday app. "
    "Recommend ONLY dishes from the provided catalog, using their exact names. "
    "Reply in the same language the user writes in. Keep the reply to 2-4 sentences. "
    "Put 1-4 exact catalog dish names that best fit the request in suggested_dishes "
    "(it may be empty if nothing fits)."
)


def _format_catalog(foods: list[dict]) -> str:
    lines = []
    for f in foods:
        tag = f" [{f['tag']}]" if f.get("tag") else ""
        lines.append(
            f"- {f['name']} ({f['category']} · {f['restaurant']} · {f['rating']}★){tag}"
        )
    return "\n".join(lines)


def _parse_json_object(content: str) -> dict:
    """Parse a JSON object, tolerating accidental markdown code fences."""
    text = (content or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3]
    return json.loads(text.strip())


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """Generate a recommendation grounded in the real Supabase foods catalog."""
    if config.OPENCODE_API_KEY is None or config.supabase is None:
        return ChatResponse(
            reply="The AI isn't configured on the server yet (missing OPENCODE_API_KEY or Supabase keys).",
            action=None,
            suggested_dishes=[],
        )

    try:
        foods = (
            config.supabase.table("foods")
            .select("name, category, restaurant, rating, tag")
            .order("rating", desc=True)
            .limit(30)
            .execute()
            .data
            or []
        )
        valid_names = {f["name"] for f in foods}

        favs = [f for f in (request.favorites or []) if f]
        fav_line = f"\n\nThe user's saved favorites: {', '.join(favs)}." if favs else ""

        prompt = (
            f"Here is the full dish catalog:\n{_format_catalog(foods)}"
            f"{fav_line}\n\nUser message: {request.user_message}"
        )

        resp = httpx.post(
            f"{config.OPENCODE_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {config.OPENCODE_API_KEY}",
                "Content-Type": "application/json",
                "User-Agent": "opencode/1.0",
                "x-opencode-session": str(uuid.uuid4()),
            },
            json={
                "model": config.OPENCODE_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            f"{SYSTEM_INSTRUCTION}\n"
                            "IMPORTANT: Output MUST be a valid JSON object with exactly two keys: "
                            '"reply" (string) and "suggested_dishes" (array of exact catalog dish name strings).'
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.7,
            },
            timeout=25.0,
        )
        resp.raise_for_status()

        content = resp.json()["choices"][0]["message"]["content"]
        data = _parse_json_object(content)
        reply = (data.get("reply") or "").strip() or "Here are a few ideas for you!"
        # validate suggestions against the catalog (no hallucinated dishes)
        dishes = [d for d in data.get("suggested_dishes", []) if d in valid_names][:4]
        return ChatResponse(reply=reply, action=None, suggested_dishes=dishes)

    except Exception as exc:  # noqa: BLE001 — degrade gracefully for the client
        print(f"[chat] error: {exc}")
        return ChatResponse(
            reply="Sorry, I couldn't think of a recommendation just now. Please try again in a moment.",
            action=None,
            suggested_dishes=[],
        )


@router.get("/dish-image")
def dish_image(q: str = Query(..., min_length=1)):
    """Proxy Unsplash search so the access key stays server-side."""
    if not config.UNSPLASH_ACCESS_KEY:
        return {"images": []}
    try:
        r = httpx.get(
            "https://api.unsplash.com/search/photos",
            params={"query": q, "per_page": 4, "orientation": "squarish"},
            headers={"Authorization": f"Client-ID {config.UNSPLASH_ACCESS_KEY}"},
            timeout=10,
        )
        r.raise_for_status()
        results = r.json().get("results", [])
        return {
            "images": [
                {
                    "url": x["urls"]["regular"],
                    "alt": x.get("alt_description") or q,
                    "credit": x.get("user", {}).get("name", "Unsplash"),
                }
                for x in results
            ]
        }
    except Exception as exc:  # noqa: BLE001
        print(f"[dish-image] error: {exc}")
        return {"images": []}
