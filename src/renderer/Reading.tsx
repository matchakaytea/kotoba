import { useEffect, useRef, type FormEvent } from 'react';
import { bind, toHiragana, unbind } from 'wanakana';
import { gradeReading, type GradeResult } from '../shared/grading';
import { useI18n } from './i18n/i18n';
import type { ReadingQuestion } from '../shared/test-schema';

type Props = {
  question: ReadingQuestion;
  answered: boolean;
  onAnswer: (result: GradeResult, answer: string) => void;
};

export function Reading({ question, answered, onAnswer }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    bind(input, { IMEMode: 'toHiragana' });
    input.focus();
    return () => unbind(input);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const raw = inputRef.current?.value ?? '';
    const answer = toHiragana(raw, { convertLongVowelMark: false });
    if (answer.trim() === '') return;
    onAnswer(gradeReading(question, answer), answer);
  }

  return (
    <section>
      <p className="prompt-kanji" lang="ja">
        {question.prompt}
      </p>
      {question.context && (
        <p className="context" lang="ja">
          {question.context}
        </p>
      )}
      <form onSubmit={submit}>
        <input
          ref={inputRef}
          className="answer-input"
          placeholder={t('review.readingPlaceholder')}
          disabled={answered}
          lang="ja"
          autoComplete="off"
        />
      </form>
    </section>
  );
}
