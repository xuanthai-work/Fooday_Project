import json
import math
import re
import time
import unicodedata
import urllib.parse
import uuid
from concurrent.futures import ThreadPoolExecutor

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.models import ChatMessage, ChatRequest, ChatResponse, DishCardInfo, ParseMapResponse
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
    "(it may be empty if nothing fits). "
    "Read the earlier conversation turns before answering: if the user rejects a dish "
    "you suggested, drop it and offer a different one instead of repeating it. "
    "When the catalog lists a distance, mention the closest restaurants and how far away "
    "they are from the user."
)

# Mean Earth radius in kilometres (Haversine).
EARTH_RADIUS_KM = 6371.0

# A restaurant inside this radius counts as "close" to the user.
NEAR_RADIUS_KM = 15.0

# How many dishes are read from Supabase for a single request.
CATALOG_FETCH_LIMIT = 300

# How many dishes are actually shown to the model (search hits come first).
CATALOG_PROMPT_LIMIT = 60

# The client sends the last few turns; the model only needs a short window.
MAX_HISTORY_MESSAGES = 6

# Columns of the `foods` table, from the richest to the most defensive set.
CATALOG_COLUMNS = (
    "id, name, category, restaurant, rating, tag, image_url, address, "
    "google_map_url, branches"
)
CATALOG_COLUMNS_NO_BRANCHES = (
    "id, name, category, restaurant, rating, tag, image_url, address, google_map_url"
)
CATALOG_COLUMNS_MINIMAL = "id, name, category, restaurant, rating, tag, image_url"

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
        distance = f.get("_distance_km")
        distance_text = (
            f" · cách {distance:.1f}km" if isinstance(distance, (int, float)) else ""
        )
        lines.append(
            f"- {f.get('name')} ({f.get('category')} · {f.get('restaurant')} · "
            f"{f.get('rating')}★{distance_text}){tag}"
        )
    return "\n".join(lines)


# --------------------------------------------------------------------------- #
# Catalog search (the "tool" the assistant uses to look dishes up)
# --------------------------------------------------------------------------- #

# Vietnamese letters with no canonical decomposition, folded to ASCII so
# "Phở Bò" and "pho bo" land on the same key.
_VN_FOLD = {
    **{ord(ch): base for base, chars in (
        ("a", "àáảãạăằắẳẵặâầấẩẫậ"),
        ("e", "èéẻẽẹêềếểễệ"),
        ("i", "ìíỉĩị"),
        ("o", "òóỏõọôồốổỗộơờớởỡợ"),
        ("u", "ùúủũụưừứửữự"),
        ("y", "ỳýỷỹỵ"),
    ) for ch in chars},
    ord("đ"): "d",
}

# Words that carry no search intent in a food request.
_STOPWORDS = {
    # English
    "a", "about", "am", "an", "and", "any", "are", "be", "best", "but", "can",
    "do", "for", "from", "give", "good", "have", "help", "i", "in", "is", "it",
    "like", "me", "more", "my", "near", "nearby", "of", "on", "or", "please",
    "some", "something", "the", "to", "want", "with", "you", "your",
    # Vietnamese
    "ban", "cho", "co", "cua", "cung", "de", "duoc", "em", "gi", "giup", "hay",
    "khong", "lam", "minh", "mon", "muon", "nam", "nay", "nha", "nhat", "noi",
    "o", "quan", "ra", "rang", "sao", "thich", "toi", "trong", "va", "ve",
}


def _normalize(text: str | None) -> str:
    """Lowercase, fold accents and drop punctuation: `Phở Bò` -> `pho bo`."""
    if not text:
        return ""
    folded = unicodedata.normalize("NFD", str(text).lower().translate(_VN_FOLD))
    stripped = "".join(ch for ch in folded if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", stripped).strip()


def _contains_token(text: str, token: str) -> bool:
    """True when `token` appears in `text` as a whole word."""
    if not text or not token:
        return False
    return re.search(rf"(?<![a-z0-9]){re.escape(token)}(?![a-z0-9])", text) is not None


def _search_tokens(query: str | None) -> list[str]:
    """Meaningful words of the user request, used to search the catalog."""
    return [
        token
        for token in _normalize(query).split()
        if len(token) > 1 and token not in _STOPWORDS
    ]


def _score_food(food: dict, tokens: list[str], query: str) -> int:
    """How well a dish matches the request (0 = no match)."""
    if not tokens:
        return 0
    name = _normalize(food.get("name"))
    tag = _normalize(food.get("tag"))
    category = _normalize(food.get("category"))
    restaurant = _normalize(food.get("restaurant"))

    score = 0
    for token in tokens:
        if _contains_token(name, token):
            score += 6
        if _contains_token(tag, token):
            score += 4
        if _contains_token(category, token):
            score += 3
        if _contains_token(restaurant, token):
            score += 2

    # The user spelled the dish out: the strongest hint there is.
    if name and len(name) > 2 and name in query:
        score += 10
    return score


def _rating_of(food: dict) -> float:
    try:
        return float(food.get("rating") or 0)
    except (TypeError, ValueError):
        return 0.0


def _parse_branches(value: object) -> list[dict]:
    """Normalise the `branches` jsonb column into a list of dicts."""
    if isinstance(value, list):
        return [branch for branch in value if isinstance(branch, dict)]
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
        except (TypeError, ValueError):
            return []
        if isinstance(parsed, list):
            return [branch for branch in parsed if isinstance(branch, dict)]
    return []


def _extract_coords(url: str | None) -> tuple[float, float] | None:
    """Coordinates carried by a Google Maps link, when it exposes them."""
    if not url:
        return None
    coords = _coords_from_url(str(url))
    if not coords:
        return None
    lat, lng = coords
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None
    return lat, lng


def _food_points(food: dict) -> list[tuple[float, float]]:
    """Every known position of a dish: its own link plus every branch."""
    points: list[tuple[float, float]] = []
    own = _extract_coords(food.get("google_map_url"))
    if own:
        points.append(own)
    resolved = food.get("_resolved_coords")
    if isinstance(resolved, tuple) and len(resolved) == 2:
        points.append(resolved)
    for branch in _parse_branches(food.get("branches")):
        lat = branch.get("lat")
        lng = branch.get("lng")
        if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
            points.append((float(lat), float(lng)))
            continue
        branch_resolved = branch.get("_resolved_coords")
        if isinstance(branch_resolved, tuple) and len(branch_resolved) == 2:
            points.append(branch_resolved)
            continue
        branch_coords = _extract_coords(branch.get("google_map_url"))
        if branch_coords:
            points.append(branch_coords)
    return points


# Coordinates of the shortened Google Maps links, cached for the process.
_LINK_COORDS_CACHE: dict[str, tuple[float, float] | None] = {}

# How many links may be expanded for a single request.
MAX_LINK_RESOLUTIONS = 8

# Timeout of a single link expansion.
LINK_RESOLVE_TIMEOUT = 4.0


def _resolve_link_coords(url: str) -> tuple[float, float] | None:
    """Coordinates hidden behind a shortened Google Maps link.

    The link is expanded once; the result (including a failure) is cached so
    the next request never pays for it again.
    """
    key = url.strip()
    if not key:
        return None
    if key in _LINK_COORDS_CACHE:
        return _LINK_COORDS_CACHE[key]

    coords: tuple[float, float] | None = None
    try:
        with httpx.Client(
            follow_redirects=True,
            timeout=LINK_RESOLVE_TIMEOUT,
            headers={"User-Agent": MAPS_USER_AGENT},
        ) as client:
            response = client.get(key)
            coords = _coords_from_url(str(response.url))
    except Exception as exc:  # noqa: BLE001 — a dish without distance is fine
        print(f"[chat] could not expand the map link: {exc}")

    _LINK_COORDS_CACHE[key] = coords
    return coords


def _attach_link_coords(foods: list[dict]) -> None:
    """Resolve the coordinates hidden in the shortened Google Maps links."""
    holders: dict[str, list[dict]] = {}
    for food in foods:
        url = food.get("google_map_url")
        if url and not _extract_coords(url):
            holders.setdefault(url.strip(), []).append(food)
        for branch in _parse_branches(food.get("branches")):
            branch_url = branch.get("google_map_url")
            has_point = isinstance(branch.get("lat"), (int, float)) and isinstance(
                branch.get("lng"), (int, float)
            )
            if branch_url and not has_point and not _extract_coords(branch_url):
                holders.setdefault(branch_url.strip(), []).append(branch)

    urls = list(holders.keys())[:MAX_LINK_RESOLUTIONS]
    if not urls:
        return
    with ThreadPoolExecutor(max_workers=min(6, len(urls))) as pool:
        results = list(pool.map(_resolve_link_coords, urls))
    for url, coords in zip(urls, results):
        if not coords:
            continue
        for holder in holders[url]:
            holder["_resolved_coords"] = coords


def _calc_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points, in kilometres (Haversine)."""
    to_rad = math.radians
    d_lat = to_rad(lat2 - lat1)
    d_lon = to_rad(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1 - a)))
    return EARTH_RADIUS_KM * c


def _distance_to(food: dict, coords) -> float | None:
    """Distance from the user to the closest outlet of a dish, in km."""
    if coords is None:
        return None
    best: float | None = None
    for lat, lng in _food_points(food):
        distance = _calc_distance(coords.lat, coords.lng, lat, lng)
        if best is None or distance < best:
            best = distance
    return best


def _rank_catalog(foods: list[dict], query: str, coords) -> list[dict]:
    """Order the catalog for the prompt.

    Matching dishes come first, restaurants near the user come next, and the
    remaining dishes fill the list by rating. Every dish keeps its distance in
    `_distance_km` so the prompt and the cards can show it.
    """
    normalized_query = _normalize(query)
    tokens = _search_tokens(query)

    ranked: list[tuple[dict, int, float | None]] = []
    for food in foods:
        score = _score_food(food, tokens, normalized_query)
        distance = _distance_to(food, coords)
        food["_distance_km"] = distance
        ranked.append((food, score, distance))

    def tier(item: tuple[dict, int, float | None]) -> int:
        _, score, distance = item
        near = distance is not None and distance <= NEAR_RADIUS_KM
        if score > 0 and near:
            return 0
        if score > 0:
            return 1
        if near:
            return 2
        return 3

    ranked.sort(
        key=lambda item: (
            tier(item),
            -item[1],
            item[2] if item[2] is not None else math.inf,
            -_rating_of(item[0]),
        )
    )
    return [food for food, _, _ in ranked[:CATALOG_PROMPT_LIMIT]]


def _fetch_catalog() -> list[dict]:
    """Read the whole dish catalog, tolerating missing optional columns."""
    if config.supabase is None:
        return []
    for columns in (CATALOG_COLUMNS, CATALOG_COLUMNS_NO_BRANCHES, CATALOG_COLUMNS_MINIMAL):
        try:
            response = (
                config.supabase.table("foods")
                .select(columns)
                .order("rating", desc=True)
                .limit(CATALOG_FETCH_LIMIT)
                .execute()
            )
            if getattr(response, "error", None):
                raise RuntimeError(str(response.error))
            return response.data or []
        except Exception as exc:  # noqa: BLE001 — try a narrower column set
            print(f"[chat] catalog query failed ({columns}): {exc}")
    return []


# --------------------------------------------------------------------------- #
# Model plumbing
# --------------------------------------------------------------------------- #


def _first_json_block(text: str) -> str | None:
    """The first balanced `{...}` block of the text (string literals respected)."""
    depth = 0
    start = -1
    in_string = False
    escaped = False
    for index, char in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            if depth == 0:
                start = index
            depth += 1
        elif char == "}" and depth > 0:
            depth -= 1
            if depth == 0 and start >= 0:
                return text[start : index + 1]
    return None


def _parse_json_object(content: str) -> dict:
    """Parse the JSON object of a model answer, never raising.

    The model sometimes wraps the object in a markdown fence or adds a
    sentence around it, so the text is scanned for a `{...}` block before the
    parser gives up. A malformed answer degrades to an empty dict instead of
    crashing the endpoint.
    """
    text = (content or "").strip()
    if not text:
        return {}

    candidates: list[str] = [text]

    # The answer without its markdown code fence.
    unfenced = re.sub(r"^```[a-zA-Z0-9_-]*\s*", "", text)
    unfenced = re.sub(r"\s*```$", "", unfenced).strip()
    if unfenced and unfenced != text:
        candidates.append(unfenced)

    # The JSON block itself, whatever surrounds it.
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        candidates.append(match.group(0))

    block = _first_json_block(text)
    if block:
        candidates.append(block)

    for candidate in candidates:
        try:
            data = json.loads(candidate)
        except (TypeError, ValueError):
            continue
        if isinstance(data, dict):
            return data
    return {}


def _history_messages(history: list[ChatMessage] | None) -> list[dict]:
    """Turn the client-side conversation history into model messages."""
    messages: list[dict] = []
    for item in history or []:
        role = (item.role or "").strip().lower()
        content = (item.content or "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        messages.append({"role": role, "content": content})
    return messages[-MAX_HISTORY_MESSAGES:]


def _call_opencode(messages: list[dict]) -> str:
    """Send the conversation to OpenCode, retrying once on transient failures."""
    payload = {
        "model": config.OPENCODE_MODEL,
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": 0.7,
    }
    last_error: Exception | None = None
    for attempt in range(2):
        try:
            response = httpx.post(
                f"{config.OPENCODE_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {config.OPENCODE_API_KEY}",
                    "Content-Type": "application/json",
                    "User-Agent": "opencode/1.0",
                    "x-opencode-session": str(uuid.uuid4()),
                },
                json=payload,
                timeout=35.0,
            )
            if response.status_code == 429 or response.status_code >= 500:
                raise httpx.HTTPStatusError(
                    f"OpenCode returned {response.status_code}",
                    request=response.request,
                    response=response,
                )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]
        except Exception as exc:  # noqa: BLE001 — one retry, then give up
            last_error = exc
            print(f"[chat] opencode request failed (attempt {attempt + 1}/2): {exc}")
            if attempt == 0:
                time.sleep(1)
    raise last_error if last_error is not None else RuntimeError("OpenCode request failed")


def _food_priority(food: dict) -> tuple[float, float]:
    """Sort key of a dish: the closest outlet first, then the best rated."""
    distance = food.get("_distance_km")
    return (
        float(distance) if isinstance(distance, (int, float)) else math.inf,
        -_rating_of(food),
    )


def _build_food_index(foods: list[dict]) -> dict[str, dict]:
    """Index the catalog by dish name.

    Several rows can share a name (the same buffet in different restaurants);
    the closest outlet wins, so the card points at the place near the user.
    """
    index: dict[str, dict] = {}
    for food in foods:
        key = _normalize(food.get("name"))
        if not key:
            continue
        current = index.get(key)
        if current is None or _food_priority(food) < _food_priority(current):
            index[key] = food
    return index


def _validate_dishes(
    raw_dishes: object, foods_by_name: dict[str, dict]
) -> list[str]:
    """Keep only dish names that really exist in the catalog (no hallucinations)."""
    dishes: list[str] = []
    for item in raw_dishes or []:
        if not isinstance(item, str):
            continue
        name = item.strip()
        if not name:
            continue
        food = foods_by_name.get(_normalize(name))
        if food is None:
            continue
        canonical = str(food.get("name") or name)
        if canonical not in dishes:
            dishes.append(canonical)
    return dishes[:4]


def _build_cards(dishes: list[str], foods_by_name: dict[str, dict]) -> list[DishCardInfo]:
    """Turn the suggested dish names into rich cards for the chat bubble."""
    cards: list[DishCardInfo] = []
    for name in dishes:
        food = foods_by_name.get(_normalize(name))
        if food is None:
            continue
        distance = food.get("_distance_km")
        cards.append(
            DishCardInfo(
                id=int(food.get("id") or 0),
                name=str(food.get("name") or ""),
                restaurant=str(food.get("restaurant") or ""),
                rating=_rating_of(food),
                image_url=str(food.get("image_url") or ""),
                distance_km=float(distance) if isinstance(distance, (int, float)) else None,
                address=food.get("address") or None,
            )
        )
    return cards


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """Generate a recommendation grounded in the real Supabase foods catalog.

    The assistant searches the whole catalog (not a fixed list of 30 dishes),
    keeps the conversation context so follow-up questions make sense, and knows
    how far the user is from every restaurant when a GPS position is sent.
    """
    lang = _lang(request)
    copy = FALLBACKS[lang]

    if config.OPENCODE_API_KEY is None or config.supabase is None:
        return ChatResponse(
            reply=copy["unconfigured"],
            action=None,
            suggested_dishes=[],
            suggested_cards=[],
            fallback="unconfigured",
        )

    try:
        foods = _fetch_catalog()
        _attach_link_coords(foods)

        coords = request.user_coords
        catalog = _rank_catalog(foods, request.user_message, coords)
        foods_by_name = _build_food_index(foods)

        favs = [f for f in (request.favorites or []) if f]
        fav_line = f"\n\nThe user's saved favorites: {', '.join(favs)}." if favs else ""
        coords_line = ""
        if coords is not None:
            coords_line = (
                f"\n\nThe user is at {coords.lat:.5f}, {coords.lng:.5f}. "
                "Entries with a distance are the closest restaurants to them - "
                "prefer them and mention how far away they are."
            )

        prompt = (
            f"Here is the dish catalog:\n{_format_catalog(catalog)}"
            f"{fav_line}{coords_line}"
            f"\n\nUser message: {request.user_message}"
        )

        messages = [
            {
                "role": "system",
                "content": (
                    f"{SYSTEM_INSTRUCTION}\n"
                    "IMPORTANT: Output MUST be a valid JSON object with exactly two keys: "
                    '"reply" (string) and "suggested_dishes" (array of exact catalog dish name strings).'
                ),
            }
        ]
        # The earlier turns come first, so the model can answer follow-ups.
        messages.extend(_history_messages(request.conversation_history))
        messages.append({"role": "user", "content": prompt})

        content = _call_opencode(messages)
        data = _parse_json_object(content)

        raw_reply = (data.get("reply") or "").strip()
        if not raw_reply and not data:
            # The model answered in plain text instead of JSON - keep it.
            plain = (content or "").strip()
            if plain and not plain.startswith(("{", "[")):
                raw_reply = plain
        reply = raw_reply or copy["empty"]

        # validate suggestions against the catalog (no hallucinated dishes)
        dishes = _validate_dishes(data.get("suggested_dishes"), foods_by_name)
        cards = _build_cards(dishes, foods_by_name)

        return ChatResponse(
            reply=reply,
            action=None,
            suggested_dishes=dishes,
            suggested_cards=cards,
            fallback=None if raw_reply else "empty",
        )

    except Exception as exc:  # noqa: BLE001 — degrade gracefully for the client
        print(f"[chat] error: {exc}")
        return ChatResponse(
            reply=copy["error"],
            action=None,
            suggested_dishes=[],
            suggested_cards=[],
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


def _extract_place_id(url: str, html: str = "") -> str | None:
    """Extract the unique Google Maps identifier of a place.

    Google encodes a place either as a hex feature id (`!1s0x...:0x...`) or as
    a numeric/hex `cid` query parameter. The same marker also shows up in the
    `APP_INITIALIZATION_STATE` payload of the page, so the HTML is searched as
    a fallback when the (possibly shortened) URL does not carry it.
    """
    sources = (url or "", html or "")
    hex_pattern = re.compile(r"!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)")
    cid_pattern = re.compile(r"[?&]cid=([0-9a-fA-F]+|\d+)")
    feature_pattern = re.compile(r"(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)")

    for source in sources:
        match = hex_pattern.search(source)
        if match:
            return match.group(1)

    for source in sources:
        match = cid_pattern.search(source)
        if match:
            return match.group(1)

    # Last resort: the raw feature id inside the page script payload.
    if html:
        match = feature_pattern.search(html)
        if match:
            return match.group(1)
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
    place_id = _extract_place_id(resolved_url, html) or _extract_place_id(raw)

    return ParseMapResponse(
        restaurant_name=name,
        address=address,
        resolved_url=resolved_url,
        place_id=place_id,
    )
