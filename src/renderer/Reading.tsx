import { useEffect, useRef, type FormEvent } from 'react';
import { bind, toHiragana, unbind } from 'wanakana';
import { gradeReading, type GradeResult } from '../shared/grading';
import type { ReadingQuestion } from '../shared/test-schema';

type Props = {
  question: ReadingQuestion;
  answered: boolean;
  onAnswer: (result: GradeResult) => void;
};

export function Reading({ question, answered, onAnswer }: Props) {
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
    onAnswer(gradeReading(question, answer));
  }

  return (
    <section>
      <p className="prompt-kanji">{question.prompt}</p>
      {question.context && <p className="context">{question.context}</p>}
      <form onSubmit={submit}>
        <input
          ref={inputRef}
          className="answer-input"
          placeholder="Type the reading (romaji is fine)"
          disabled={answered}
          lang="ja"
          autoComplete="off"
        />
      </form>
    </section>
  );
}
