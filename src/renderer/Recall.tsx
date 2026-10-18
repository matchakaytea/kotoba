import { useEffect, useRef, type FormEvent } from 'react';
import { bind, toHiragana, unbind } from 'wanakana';
import { gradeRecall, type GradeResult } from '../shared/grading';
import { localizeQuestion } from '../shared/localize';
import type { RecallQuestion } from '../shared/test-schema';
import { useI18n } from './i18n/i18n';

type Props = {
  question: RecallQuestion;
  answered: boolean;
  onAnswer: (result: GradeResult, answer: string) => void;
};

export function Recall({ question, answered, onAnswer }: Props) {
  const { t, language } = useI18n();
  const shown = localizeQuestion(question, language);
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
    onAnswer(gradeRecall(question, answer), answer);
  }

  return (
    <section>
      <p className="prompt-text">{shown.prompt}</p>
      {question.context && (
        <p className="context" lang="ja">
          {question.context}
        </p>
      )}
      <form onSubmit={submit}>
        <input
          ref={inputRef}
          className="answer-input"
          placeholder={t('review.recallPlaceholder')}
          disabled={answered}
          lang="ja"
          autoComplete="off"
        />
      </form>
    </section>
  );
}
