export interface ChatRequest {
  user_message: string;
  user_id?: string;
}

export interface ChatResponse {
  reply: string;
  action: string | null;
  suggested_dishes: string[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:2001/api/v1';

export const chatService = {
  async sendMessage(message: string, userId: string = 'nextjs_user'): Promise<ChatResponse | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_message: message,
          user_id: userId,
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
