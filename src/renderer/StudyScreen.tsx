import { useCallback, useEffect, useState } from 'react';
import type { Language, Mistake, StudyPlan, StudyWord } from '../shared/api';
import { describeMistake } from '../shared/localize';
import { Furigana } from './Furigana';
import { useI18n } from './i18n/i18n';

type Props = {
  plan: StudyPlan;
  onStart: () => void;
  onExit: () => void;
};

type Card =
  | { kind: 'word'; word: StudyWord; index: number; total: number }
  | { kind: 'mistake'; mistake: Mistake; index: number; total: number };

function cardsOf(plan: StudyPlan): Card[] {
  return [
    ...plan.words.map((word, i) => ({
      kind: 'word' as const,
      word,
      index: i + 1,
      total: plan.words.length,
    })),
    ...plan.mistakes.map((mistake, i) => ({
      kind: 'mistake' as const,
      mistake,
      index: i + 1,
      total: plan.mistakes.length,
    })),
  ];
}

// Definitions come in English, Simplified and Traditional Chinese; Korean
// falls back to Simplified Chinese, as on the Vocabulary page.
function meaningOf(word: StudyWord, language: Language): string | null {
  if (language === 'en') return word.meaningEn;
  return language === 'zh-Hant' ? word.meaningTc : word.meaningSc;
}

/**
 * A short look before the review: today's new words one at a time, then
 * recent mistakes to recall before their answer is shown.
 */
export function StudyScreen({ plan, onStart, onExit }: Props) {
  const { t } = useI18n();
  const [cards] = useState(() => cardsOf(plan));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const card = cards[index] as Card | undefined;
  const needsReveal = card?.kind === 'mistake' && !revealed;

  const advance = useCallback(() => {
    if (needsReveal) {
      setRevealed(true);
      return;
    }
    setRevealed(false);
    setIndex((i) => i + 1);
  }, [needsReveal]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.isComposing) return;
      if (event.key === 'Escape') onExit();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExit]);

  const progress = Math.round((index / cards.length) * 100);

  return (
    <div className="review">
      <header className="review-header">
        <button className="back" title={t('review.backTitle')} onClick={onExit}>
          {t('review.back')}
        </button>
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={index}
          aria-valuemin={0}
          aria-valuemax={cards.length}
        >
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
        {card && (
          <button className="subtle" onClick={onStart}>
            {t('study.skip')}
          </button>
        )}
      </header>

      {card ? (
        <div className="review-body study-body">
          <p className="page-kicker">
            {t(card.kind === 'word' ? 'study.words' : 'study.mistakes', {
              index: card.index,
              total: card.total,
            })}
          </p>
          {card.kind === 'word' ? (
            <WordCard word={card.word} />
          ) : (
            <MistakeCard mistake={card.mistake} revealed={revealed} />
          )}
          <div className="study-actions">
            <button className="primary" autoFocus key={index} onClick={advance}>
              {needsReveal ? t('study.showAnswer') : t('study.next')}
            </button>
          </div>
        </div>
      ) : (
        <div className="review-done study-done">
          <p className="page-kicker">{t('study.title')}</p>
          <h1>{t('study.ready')}</h1>
          <p className="page-sub">{t('study.readySub')}</p>
          <button className="primary" autoFocus onClick={onStart}>
            {t('study.start')}
          </button>
        </div>
      )}
    </div>
  );
}

function WordCard({ word }: { word: StudyWord }) {
  const { t, language } = useI18n();
  const meaning = meaningOf(word, language);
  const example = word.example;
  return (
    <div className="study-card">
      <p className="prompt-kanji" lang="ja">
        {word.expression}
      </p>
      <p className="study-reading" lang="ja">
        {word.reading}
        {word.level && <span className="tag">N{word.level}</span>}
      </p>
      <p className="study-meaning">{meaning ?? t('study.noMeaning')}</p>
      {example && (
        <div className="vocab-example study-example">
          <p lang="ja" className="vocab-sentence">
            <Furigana source={example.furigana} />
          </p>
          <p className="cell-muted">
            {language === 'zh-Hant' ? example.tc : example.sc}
          </p>
        </div>
      )}
    </div>
  );
}

function MistakeCard({
  mistake,
  revealed,
}: {
  mistake: Mistake;
  revealed: boolean;
}) {
  const { t, language } = useI18n();
  const question = mistake.question!;
  const shown = describeMistake(question, mistake.answer, language);
  const context =
    question.template !== 'multiple_choice' ? question.context : undefined;
  return (
    <div className="study-card">
      <p
        className={
          question.template === 'reading' ? 'prompt-kanji' : 'prompt-text'
        }
        lang={question.template === 'reading' ? 'ja' : undefined}
      >
        {shown.prompt}
      </p>
      {context && (
        <p className="context" lang="ja">
          {context}
        </p>
      )}
      {revealed && (
        <div className="feedback wrong study-answer">
          <div className="feedback-text">
            <p className="feedback-title">
              {t('feedback.answer')} <strong lang="ja">{shown.expected}</strong>
            </p>
            <p className="feedback-hint">
              {t('study.yourAnswer', { answer: shown.answer })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
