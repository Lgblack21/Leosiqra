import { doc, getDoc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

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
        return data.messages.map((m: any) => ({
          role: m.role,
          text: m.text,
          timestamp: m.timestamp?.toDate ? m.timestamp.toDate() : new Date()
        }));
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
