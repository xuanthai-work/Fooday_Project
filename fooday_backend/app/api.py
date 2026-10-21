import json
import re
import urllib.parse
import uuid

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.models import ChatRequest, ChatResponse, ParseMapResponse
from app import config


def verify_internal_secret(
    x_internal_secret: str | None = Header(None, alias="x-internal-secret"),
) -> None:
    """Validate internal secret header if configured on the server."""
    if config.INTERNAL_API_SECRET:
        if not x_internal_secret or x_internal_secret != config.INTERNAL_API_SECRET:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Invalid or missing internal secret",
            )


router = APIRouter(dependencies=[Depends(verify_internal_secret)])


SYSTEM_INSTRUCTION = (
    "You are Foodie AI, a warm, concise food assistant for the Fooday app. "
    "Recommend ONLY dishes from the provided catalog, using their exact names. "
    "Reply in the same language the user writes in. Keep the reply to 2-4 sentences. "
    "Put 1-4 exact catalog dish names that best fit the request in suggested_dishes "
    "(it may be empty if nothing fits)."
)

# System fallbacks. The app default language is Vietnamese.
FALLBACKS = {
    "vi": {
        "unconfigured": "Mình chưa được cấu hình trên máy chủ (thiếu khóa OpenCode hoặc Supabase).",
        "error": "Xin lỗi, mình chưa nghĩ ra gợi ý lúc này. Bạn thử lại sau một chút nhé.",
        "empty": "Đây là vài gợi ý cho bạn!",
    },
    "en": {
        "unconfigured": "The AI isn't configured on the server yet (missing OPENCODE_API_KEY or Supabase keys).",
        "error": "Sorry, I couldn't think of a recommendation just now. Please try again in a moment.",
        "empty": "Here are a few ideas for you!",
    },
}


def _lang(request: ChatRequest) -> str:
    code = (request.language or "").strip().lower()
    return code if code in FALLBACKS else "vi"


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
    lang = _lang(request)
    copy = FALLBACKS[lang]

    if config.OPENCODE_API_KEY is None or config.supabase is None:
        return ChatResponse(
            reply=copy["unconfigured"],
            action=None,
            suggested_dishes=[],
            fallback="unconfigured",
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
            timeout=35.0,
        )
        resp.raise_for_status()

        content = resp.json()["choices"][0]["message"]["content"]
        data = _parse_json_object(content)
        raw_reply = (data.get("reply") or "").strip()
        reply = raw_reply or copy["empty"]
        # validate suggestions against the catalog (no hallucinated dishes)
        dishes = [d for d in data.get("suggested_dishes", []) if d in valid_names][:4]
        return ChatResponse(
            reply=reply,
            action=None,
            suggested_dishes=dishes,
            fallback=None if raw_reply else "empty",
        )

    except Exception as exc:  # noqa: BLE001 — degrade gracefully for the client
        print(f"[chat] error: {exc}")
        return ChatResponse(
            reply=copy["error"],
            action=None,
            suggested_dishes=[],
            fallback="error",
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


# --------------------------------------------------------------------------- #
# Google Maps link parsing
# --------------------------------------------------------------------------- #

# Link shapes we accept before hitting the network.
MAPS_LINK_MARKERS = (
    "google.com/maps",
    "maps.google.com",
    "maps.app.goo.gl",
    "goo.gl/maps",
)

# A normal browser UA so Google serves the same page it serves to users.
MAPS_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# Nominatim asks every caller to identify itself.
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_USER_AGENT = "FoodayApp/1.0"

# Cap the amount of HTML we buffer while streaming a Google Maps page.
MAX_HTML_CHARS = 2_000_000

# OpenStreetMap address key -> Vietnamese label used in the composed address.
ADDRESS_LABELS = {
    "road": "Đường",
    "pedestrian": "Đường",
    "footway": "Đường",
    "residential": "Đường",
    "lane": "Đường",
    "suburb": "Phường",
    "village": "Xã",
    "city_district": "Quận",
    "district": "Quận",
    "borough": "Quận",
    "city": "TP.",
    "town": "TP.",
    "municipality": "TP.",
    "state": "Tỉnh",
    "province": "Tỉnh",
    "county": "Tỉnh",
}

# Street-level keys: the house number is attached to the first of them.
STREET_KEYS = {"road", "pedestrian", "footway", "residential", "lane"}

# Order in which address parts are rendered: street -> ward -> district -> city.
ADDRESS_ORDER = (
    "road",
    "pedestrian",
    "footway",
    "residential",
    "lane",
    "suburb",
    "village",
    "city_district",
    "district",
    "borough",
    "city",
    "town",
    "municipality",
    "state",
    "province",
    "county",
)

# Prefixes that already carry the meaning of the label, so we do not repeat it.
LABEL_PREFIXES = {
    "Đường": ("đường", "phố"),
    "Phường": ("phường",),
    "Quận": ("quận", "huyện"),
    "TP.": ("tp.", "tp", "thành phố", "thị trấn", "thị xã"),
    "Tỉnh": ("tỉnh",),
    "Xã": ("xã",),
}


def _unescape(value: str) -> str:
    """Unescape a JSON-ish string taken from an HTML payload."""
    try:
        return json.loads(f'"{value}"')
    except Exception:  # noqa: BLE001 — fall back to the raw text
        return value


def _looks_like_map_link(url: str) -> bool:
    lowered = url.lower()
    return any(marker in lowered for marker in MAPS_LINK_MARKERS)


def _name_from_path(url: str) -> str | None:
    """Read the place name from a /maps/place/<name>/ style path."""
    match = re.search(r"/maps/place/([^/?#]+)", url)
    if match:
        name = urllib.parse.unquote_plus(match.group(1)).strip()
        if name:
            return name

    # https://www.google.com/maps/<Place Name>/@12.34,56.78,17z
    match = re.search(r"/maps/([^/?#@]+)/@", url)
    if match:
        name = urllib.parse.unquote_plus(match.group(1)).strip()
        if name:
            return name
    return None


def _coords_from_url(url: str) -> tuple[float, float] | None:
    """Pull the place coordinates out of a Google Maps URL.

    A Maps URL carries two kinds of coordinates: the camera center
    (`@lat,lng`) — where the map happened to be opened — and the pinned place
    (`!3dlat!4dlng`) — the place the user actually shared. The pinned place
    always wins, otherwise a link opened in Cầu Giấy resolves to Cầu Giấy.
    """
    # (pattern, swaps the two captured values)
    patterns = (
        (r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)", False),  # pinned place: lat, lng
        (r"!4d(-?\d+\.\d+)!3d(-?\d+\.\d+)", True),  # pinned place: lng, lat
        (r"[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)", False),  # ll query point: lat, lng
        (r"@(-?\d+\.\d+),(-?\d+\.\d+)", False),  # camera center: lat, lng
    )
    for pattern, swapped in patterns:
        match = re.search(pattern, url)
        if not match:
            continue
        try:
            first = float(match.group(1))
            second = float(match.group(2))
        except (TypeError, ValueError):
            continue
        return (second, first) if swapped else (first, second)
    return None


def _name_and_coords_from_html(html: str) -> tuple[str | None, tuple[float, float] | None]:
    """Search the APP_INITIALIZATION_STATE payload for the place name/coordinates."""
    marker = "APP_INITIALIZATION_STATE"
    index = html.find(marker)
    if index == -1:
        return None, None

    chunk = html[index : index + MAX_HTML_CHARS]
    # Place payloads look like:  "Place Name",[[10.7769,106.7009]
    match = re.search(
        r'"((?:[^"\\]|\\.){2,120})",\s*\[\s*\[\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)',
        chunk,
    )
    name = _unescape(match.group(1)).strip() if match else ""

    # The pinned place lives in a [null, null, lat, lng] tuple and is more
    # accurate than the camera center, so it takes precedence.
    pin = re.search(r"\[null,\s*null,\s*(-?\d+\.\d+),\s*(-?\d+\.\d+)\]", chunk)
    if pin:
        try:
            return (name or None), (float(pin.group(1)), float(pin.group(2)))
        except (TypeError, ValueError):
            pass

    if not match:
        return None, None

    try:
        coords = (float(match.group(2)), float(match.group(3)))
    except (TypeError, ValueError):
        coords = None
    return (name or None), coords


def _label_part(label: str, value: str) -> str:
    """Prefix a value with its label unless it already carries it."""
    text = value.strip()
    if not label:
        return text
    prefixes = LABEL_PREFIXES.get(label, ())
    lowered = text.lower()
    for prefix in prefixes:
        if not lowered.startswith(prefix):
            continue
        # The prefix has to end on a word boundary, otherwise "Phố" would
        # swallow "Phống" and "Đường Phố Trương Công Giai" would repeat.
        rest = lowered[len(prefix) :]
        if not rest or rest[0] in " .,;:-/":
            return text
    return f"{label} {text}"


def _compose_address(details: dict) -> str:
    """Build a friendly Vietnamese address from an OSM address-details object."""
    city_value = (
        details.get("city") or details.get("town") or details.get("municipality") or ""
    ).strip().lower()

    house_number = str(details.get("house_number") or "").strip()
    parts: list[str] = []
    seen: set[str] = set()

    for key in ADDRESS_ORDER:
        value = details.get(key)
        if not value:
            continue
        text = str(value).strip()
        if not text:
            continue
        normalized = text.lower()
        if normalized in seen:
            continue
        # The state often repeats the city (e.g. "Ho Chi Minh" / "Ho Chi Minh City").
        if key in {"state", "province", "county"} and city_value and normalized in city_value:
            continue
        seen.add(normalized)

        piece = _label_part(ADDRESS_LABELS.get(key, ""), text)
        if house_number and key in STREET_KEYS:
            piece = f"{house_number} {piece}"
            seen.add(house_number.lower())
            house_number = ""
        parts.append(piece)

    if house_number:
        if parts:
            parts[0] = f"{house_number} {parts[0]}"
        else:
            parts.append(house_number)

    return ", ".join(parts)


def _reverse_geocode(lat: float, lng: float) -> str | None:
    """Resolve coordinates into a human friendly address via OpenStreetMap."""
    payload = None
    for attempt in range(2):
        try:
            response = httpx.get(
                NOMINATIM_URL,
                params={
                    "format": "json",
                    "lat": lat,
                    "lon": lng,
                    "addressdetails": 1,
                },
                headers={"User-Agent": NOMINATIM_USER_AGENT},
                timeout=15.0,
            )
            response.raise_for_status()
            payload = response.json()
            break
        except Exception as exc:  # noqa: BLE001 — degrade gracefully
            print(f"[parse-map-link] reverse geocode failed ({attempt + 1}/2): {exc}")

    if not payload:
        return None

    details = payload.get("address") or {}
    composed = _compose_address(details)
    if composed:
        return composed
    display = payload.get("display_name")
    return display.strip() if isinstance(display, str) and display.strip() else None


@router.get("/parse-map-link", response_model=ParseMapResponse)
def parse_map_link(url: str = Query(..., min_length=1)) -> ParseMapResponse:
    """Resolve a pasted Google Maps link into a place name and a postal address.

    Never raises: when a link cannot be parsed the response is still HTTP 200
    with all fields set to null so the client can keep working.
    """
    raw = (url or "").strip()
    if not raw or not _looks_like_map_link(raw):
        return ParseMapResponse()

    resolved_url = raw
    html = ""

    try:
        with httpx.Client(
            follow_redirects=True,
            timeout=12.0,
            headers={
                "User-Agent": MAPS_USER_AGENT,
                "Accept-Language": "vi,en;q=0.9",
            },
        ) as client:
            with client.stream("GET", raw) as response:
                resolved_url = str(response.url) or raw
                if "html" in response.headers.get("content-type", "").lower():
                    chunks: list[str] = []
                    size = 0
                    for chunk in response.iter_text():
                        chunks.append(chunk)
                        size += len(chunk)
                        if size >= MAX_HTML_CHARS:
                            break
                    html = "".join(chunks)
    except Exception as exc:  # noqa: BLE001 — keep the original URL as a fallback
        print(f"[parse-map-link] fetch failed: {exc}")

    name = _name_from_path(resolved_url) or _name_from_path(raw)
    coords = _coords_from_url(resolved_url) or _coords_from_url(raw)

    if not name or not coords:
        html_name, html_coords = _name_and_coords_from_html(html)
        name = name or html_name
        coords = coords or html_coords

    if not name:
        match = re.search(r"[?&](?:q|query)=([^&]+)", raw)
        if match:
            candidate = urllib.parse.unquote_plus(match.group(1)).strip()
            if candidate and not re.fullmatch(r"-?\d+\.?\d*,\s*-?\d+\.?\d*", candidate):
                name = candidate

    address = _reverse_geocode(*coords) if coords else None

    return ParseMapResponse(
        restaurant_name=name,
        address=address,
        resolved_url=resolved_url,
    )
