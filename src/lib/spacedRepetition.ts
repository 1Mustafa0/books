import { addDays } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

/**
 * SM-2 Algorithm implementation
 * @param quality 0-5 (0: total blackout, 5: perfect response)
 * @param prevInterval previous interval in days
 * @param prevEaseFactor previous ease factor
 */
export function calculateNextReview(
  quality: number,
  prevInterval: number,
  prevEaseFactor: number
) {
  let interval: number;
  let easeFactor: number;

  if (quality >= 3) {
    if (prevInterval === 0) {
      interval = 1;
    } else if (prevInterval === 1) {
      interval = 6;
    } else {
      interval = Math.round(prevInterval * prevEaseFactor);
    }

    easeFactor = prevEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  } else {
    interval = 1;
    easeFactor = prevEaseFactor;
  }

  if (easeFactor < 1.3) {
    easeFactor = 1.3;
  }

  const nextReviewDate = addDays(new Date(), interval);

  return {
    interval,
    easeFactor,
    nextReviewDate: Timestamp.fromDate(nextReviewDate),
    status: quality >= 3 ? 'review' : 'learning' as const
  };
}
