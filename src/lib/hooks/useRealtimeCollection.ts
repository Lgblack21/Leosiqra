import { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  QueryConstraint,
  DocumentData
} from '@/lib/cf-firestore';
import { db } from '../cf-client';

/**
 * Custom hook untuk mendengarkan perubahan collection Firestore secara real-time.
 * Otomatis cleanup listener saat komponen unmount.
 *
 * @param collectionName - Nama collection Firestore
 * @param userId - UID user yang sedang login (null = skip)
 * @param extraConstraints - Query constraint tambahan (misal where type == 'saham')
 * @param transform - Fungsi untuk transform doc.data() ke interface yang diinginkan
 */
export function useRealtimeCollection<T>(
  collectionName: string,
  userId: string | null,
  extraConstraints: QueryConstraint[] = [],
  transform?: (data: DocumentData, id: string) => T,
  orderField: string = 'createdAt',
  orderDirection: 'asc' | 'desc' = 'desc'
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!userId) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const constraints: QueryConstraint[] = [
      where('userId', '==', userId),
      ...extraConstraints,
      orderBy(orderField, orderDirection)
    ];

    const q = query(collection(db, collectionName), ...constraints);

    // Cleanup listener lama
    if (unsubRef.current) unsubRef.current();

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map(doc => {
          const raw = doc.data();
          if (transform) return transform(raw, doc.id);
          return { ...raw, id: doc.id } as T;
        });
        setData(items);
        setLoading(false);
      },
      (err) => {
        // Silently skip permission-denied errors (common during logout/auth transition)
        if (err.code !== 'permission-denied') {
          console.warn(`[useRealtimeCollection] ${collectionName} error:`, err.message);
        }
        setLoading(false);
      }
    );

    unsubRef.current = unsub;
    return () => {
      if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    };
  }, [userId, collectionName, orderField, orderDirection]);

  return { data, loading };
}

