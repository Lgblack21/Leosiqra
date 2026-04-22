import { doc, getDoc, setDoc, deleteDoc, Timestamp } from '@/lib/cf-firestore';
import { db } from '../cf-client';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

const COLLECTION_NAME = 'ai_chats';

export const aiChatService = {
  async getUserChat(userId: string): Promise<ChatMessage[] | null> {
    const docRef = doc(db, COLLECTION_NAME, userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.messages && Array.isArray(data.messages)) {
        return data.messages
          .map((m: Record<string, unknown>) => {
            const role: ChatMessage['role'] =
              m.role === 'assistant' ? 'model' : (m.role === 'user' ? 'user' : 'model');
            const text =
              typeof m.text === 'string'
                ? m.text
                : (typeof m.content === 'string' ? m.content : '');
            const timestamp = (() => {
              const rawTimestamp = m.timestamp as { toDate?: () => Date } | undefined;
              if (rawTimestamp?.toDate) {
                return rawTimestamp.toDate();
              }
              return m.createdAt ? new Date(String(m.createdAt)) : new Date();
            })();

            if (!text.trim()) {
              return null;
            }

            return {
              role,
              text,
              timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
            } as ChatMessage;
          })
          .filter(Boolean) as ChatMessage[];
      }
    }
    return null;
  },

  async saveUserChat(userId: string, messages: ChatMessage[]) {
    const docRef = doc(db, COLLECTION_NAME, userId);
    await setDoc(docRef, {
      userId,
      messages: messages.map(m => ({
        ...m,
        timestamp: Timestamp.fromDate(m.timestamp)
      })),
      updatedAt: Timestamp.now()
    }, { merge: true });
  },

  async clearUserChat(userId: string) {
    const docRef = doc(db, COLLECTION_NAME, userId);
    await deleteDoc(docRef);
  }
};

