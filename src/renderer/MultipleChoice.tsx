import { useEffect, useState } from 'react';
import { gradeMultipleChoice, type GradeResult } from '../shared/grading';
import { localizeQuestion } from '../shared/localize';
import type { MultipleChoiceQuestion } from '../shared/test-schema';
import { useI18n } from './i18n/i18n';

type Props = {
  question: MultipleChoiceQuestion;
  answered: boolean;
  onAnswer: (result: GradeResult, answer: string) => void;
};

export function MultipleChoice({ question, answered, onAnswer }: Props) {
  const { language } = useI18n();
  const [chosen, setChosen] = useState<number | null>(null);
  const shown = localizeQuestion(question, language);
  const optionsTranslated = Boolean(question.i18n?.[language]?.options);

  function choose(index: number) {
    setChosen(index);
    onAnswer(gradeMultipleChoice(shown, index), question.options[index]);
  }

  useEffect(() => {
    if (answered) return;
    function onKeyDown(event: KeyboardEvent) {
      const index = Number(event.key) - 1;
      if (index >= 0 && index < shown.options.length) {
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
      <p className="prompt-text">{shown.prompt}</p>
      <div className="options">
        {shown.options.map((option, index) => (
          <button
            key={`${index}-${option}`}
            className={optionClass(index)}
            lang={optionsTranslated ? undefined : 'ja'}
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
