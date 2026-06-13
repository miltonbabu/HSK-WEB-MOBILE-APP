// SRS (spaced repetition) helpers. Mirrors the web app's srs.ts.
import type { MasteryLevel } from '@/types';

export interface SRSParams {
  easinessFactor: number;
  interval: number;
  reviewCount: number;
}

export interface SRSUpdate {
  mastery_level: MasteryLevel;
  next_review: string;     // ISO
  easiness_factor: number;
  interval: number;
  review_count: number;
  correct_count: number;
  last_reviewed: string;
}

/**
 * Update SRS params after a user grades a card.
 * `quality` mirrors SM-2: 0..2 wrong, 3 hard, 4 good, 5 easy.
 */
export function gradeSRS(
  current: SRSParams,
  correctCount: number,
  quality: 0 | 1 | 2 | 3 | 4 | 5
): SRSUpdate {
  let { easinessFactor, interval, reviewCount } = current;
  reviewCount += 1;

  // SM-2 easiness update
  const newEF = Math.max(
    1.3,
    easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  if (quality < 3) {
    interval = 1; // reset on failure
  } else {
    if (reviewCount === 1) interval = 1;
    else if (reviewCount === 2) interval = 6;
    else interval = Math.round(interval * newEF);
  }

  // Map quality -> mastery
  const mastery_level: MasteryLevel =
    quality >= 5 ? 5 :
    quality >= 4 ? 4 :
    quality >= 3 ? 3 :
    quality >= 2 ? 2 : 1;

  const now = new Date();
  const next = new Date(now.getTime() + interval * 24 * 3600 * 1000);

  return {
    mastery_level,
    next_review: next.toISOString(),
    easiness_factor: newEF,
    interval,
    review_count: reviewCount,
    correct_count: correctCount + (quality >= 3 ? 1 : 0),
    last_reviewed: now.toISOString(),
  };
}
