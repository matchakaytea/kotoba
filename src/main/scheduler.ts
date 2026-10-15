import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  TypeConvert,
  type Card,
} from 'ts-fsrs';

const scheduler = fsrs(generatorParameters({ enable_short_term: false }));

export type ReviewState = {
  card: Card;
  dueDay: string;
  lastReviewDay: string;
};

export function localDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function review(
  previous: ReviewState | null,
  correct: boolean,
  now: Date,
): ReviewState | null {
  const today = localDay(now);
  if (previous && previous.lastReviewDay === today) {
    return null;
  }

  const card = previous ? previous.card : createEmptyCard(now);
  const next = scheduler.next(
    card,
    now,
    correct ? Rating.Good : Rating.Again,
  ).card;
  return { card: next, dueDay: localDay(next.due), lastReviewDay: today };
}

export function serializeCard(card: Card): string {
  return JSON.stringify(card);
}

export function parseCard(json: string): Card {
  return TypeConvert.card(JSON.parse(json));
}
