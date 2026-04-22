import { useState, useEffect } from 'react';
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
  const [state, setState] = useState<{
    data: T[];
    loading: boolean;
    ownerUserId: string | null;
  }>({
    data: [],
    loading: true,
    ownerUserId: null,
  });

  useEffect(() => {
    if (!userId) {
      return;
    }

    const constraints: QueryConstraint[] = [
      where('userId', '==', userId),
      ...extraConstraints,
      orderBy(orderField, orderDirection)
    ];

    const q = query(collection(db, collectionName), ...constraints);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map(doc => {
          const raw = doc.data();
          if (transform) return transform(raw, doc.id);
          return { ...raw, id: doc.id } as T;
        });
        setState({
          data: items,
          loading: false,
          ownerUserId: userId,
        });
      },
      (err) => {
        // Silently skip permission-denied errors (common during logout/auth transition)
        if (err.code !== 'permission-denied') {
          console.warn(`[useRealtimeCollection] ${collectionName} error:`, err.message);
        }
        setState((prev) => ({
          ...prev,
          loading: false,
          ownerUserId: userId,
        }));
      }
    );

    return () => unsub();
  }, [userId, collectionName, orderField, orderDirection, extraConstraints, transform]);

  const data = userId && state.ownerUserId === userId ? state.data : [];
  const loading = userId ? state.ownerUserId !== userId || state.loading : false;
  return { data, loading };
}

