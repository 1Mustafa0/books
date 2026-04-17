import { Timestamp } from 'firebase/firestore';

export interface Book {
  id: string;
  title: string;
  author?: string;
  coverUrl?: string;
  totalChapters: number;
  userId: string;
  createdAt: Timestamp;
}

export interface Chapter {
  id: string;
  bookId: string;
  title: string;
  mindMap: string; // JSON string
  userId: string;
  createdAt: Timestamp;
}

export interface Review {
  id: string;
  chapterId: string;
  userId: string;
  nextReviewDate: Timestamp;
  interval: number;
  easeFactor: number;
  lastReviewedAt?: Timestamp;
  status: 'new' | 'learning' | 'review';
}

export interface MindMapData {
  nodes: any[];
  edges: any[];
}
