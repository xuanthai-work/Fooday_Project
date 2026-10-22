/** A turn of the conversation, sent back so the model keeps the context. */
export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** GPS position of the user, used to rank restaurants by distance. */
export interface UserCoords {
  lat: number;
  lng: number;
}

/** A dish rendered as a rich card inside the chat bubble. */
export interface DishCardInfo {
  id: number;
  name: string;
  restaurant: string;
  rating: number;
  image_url: string;
  distance_km?: number | null;
  address?: string | null;
}

export interface ChatRequest {
  user_message: string;
  user_id?: string;
  favorites?: string[];
  language?: string;
  conversation_history?: ChatHistoryMessage[];
  user_coords?: UserCoords | null;
}

export type ChatFallback = 'error' | 'unconfigured' | 'empty';

export interface ChatResponse {
  reply: string;
  action: string | null;
  suggested_dishes: string[];
  suggested_cards?: DishCardInfo[];
  fallback?: ChatFallback | null;
}

/** Extra context of a chat request (multi-turn memory + GPS). */
export interface ChatContext {
  conversation_history?: ChatHistoryMessage[];
  user_coords?: UserCoords | null;
}

const resolveEndpoint = (path: string): string => {
  const env = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!env) {
    // Relative path to Next.js local BFF route handlers
    return `/api${path}`;
  }
  return `${env}${path}`;
};

export const chatService = {
  async sendMessage(
    message: string,
    favorites: string[] = [],
    userId: string = 'nextjs_user',
    language?: string,
    context: ChatContext = {},
  ): Promise<ChatResponse | null> {
    try {
      const response = await fetch(resolveEndpoint('/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_message: message,
          user_id: userId,
          favorites,
          language,
          conversation_history: context.conversation_history ?? [],
          user_coords: context.user_coords ?? null,
        } as ChatRequest),
      });

      if (!response.ok) {
        console.error(`API Error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      return data as ChatResponse;
    } catch (error) {
      console.error('Connection error sending message:', error);
      return null;
    }
  }
};

export interface DishImage {
  url: string;
  alt: string;
  credit: string;
}

export const dishImageService = {
  async search(q: string): Promise<DishImage[]> {
    try {
      const response = await fetch(resolveEndpoint('/dish-image') + `?q=${encodeURIComponent(q)}`);
      if (!response.ok) return [];
      const data = await response.json();
      return (data.images ?? []) as DishImage[];
    } catch (error) {
      console.error('Connection error searching dish image:', error);
      return [];
    }
  },
};

export interface ParsedMapInfo {
  restaurant_name?: string | null;
  address?: string | null;
  resolved_url?: string | null;
}

export const mapService = {
  async parseMapLink(url: string): Promise<ParsedMapInfo | null> {
    try {
      const response = await fetch(
        resolveEndpoint('/parse-map-link') + `?url=${encodeURIComponent(url)}`,
      );
      if (!response.ok) return null;
      const data = await response.json();
      return data as ParsedMapInfo;
    } catch (error) {
      console.error('Connection error parsing map link:', error);
      return null;
    }
  },
};
