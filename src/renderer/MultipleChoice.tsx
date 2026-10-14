import { useEffect, useState } from 'react';
import { gradeMultipleChoice, type GradeResult } from '../shared/grading';
import type { MultipleChoiceQuestion } from '../shared/test-schema';

type Props = {
  question: MultipleChoiceQuestion;
  answered: boolean;
  onAnswer: (result: GradeResult, answer: string) => void;
};

export function MultipleChoice({ question, answered, onAnswer }: Props) {
  const [chosen, setChosen] = useState<number | null>(null);

  function choose(index: number) {
    setChosen(index);
    onAnswer(gradeMultipleChoice(question, index), question.options[index]);
  }

  useEffect(() => {
    if (answered) return;
    function onKeyDown(event: KeyboardEvent) {
      const index = Number(event.key) - 1;
      if (index >= 0 && index < question.options.length) {
        choose(index);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function optionClass(index: number): string {
    if (!answered) return 'option';
    if (index === question.answer_index) return 'option correct';
    if (index === chosen) return 'option wrong';
    return 'option';
  }

  return (
    <section>
      <p className="prompt-text">{question.prompt}</p>
      <div className="options">
        {question.options.map((option, index) => (
          <button
            key={option}
            className={optionClass(index)}
            disabled={answered}
            onClick={() => choose(index)}
          >
            <span className="option-number">{index + 1}</span> {option}
          </button>
        ))}
      </div>
    </section>
  );
}
