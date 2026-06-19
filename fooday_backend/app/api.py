import json

import httpx
from fastapi import APIRouter, Query
from pydantic import BaseModel
from google.genai import types

from app.models import ChatRequest, ChatResponse
from app import config

router = APIRouter()


# Structured shape we ask Gemini to return.
class AiSuggestion(BaseModel):
    reply: str
    suggested_dishes: list[str]


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


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """Generate a recommendation grounded in the real Supabase foods catalog."""
    if config.gemini is None or config.supabase is None:
        return ChatResponse(
            reply="The AI isn't configured on the server yet (missing GEMINI/Supabase keys).",
            action=None,
            suggested_dishes=[],
        )

    try:
        foods = (
            config.supabase.table("foods")
            .select("name, category, restaurant, rating, tag")
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

        resp = config.gemini.models.generate_content(
            model=config.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                response_schema=AiSuggestion,
                temperature=0.7,
            ),
        )

        data = json.loads(resp.text)
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
