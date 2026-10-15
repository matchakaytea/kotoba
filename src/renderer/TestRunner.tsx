import { useState } from 'react';
import type { GradeResult } from '../shared/grading';
import type { LangTest, Question } from '../shared/test-schema';
import { Feedback } from './Feedback';
import { MultipleChoice } from './MultipleChoice';
import { Reading } from './Reading';

type Props = {
  test: LangTest;
  onExit: () => void;
};

export function TestRunner({ test, onExit }: Props) {
  const questions = test.questions;
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleAnswer(graded: GradeResult, answer: string) {
    setResult(graded);
    if (graded.correct) setCorrectCount((count) => count + 1);

    const question = questions[index];
    window.kotoba
      .saveAttempt({
        testId: test.test_id,
        questionIndex: index,
        template: question.template,
        answer,
        correct: graded.correct,
        targets: question.targets,
      })
      .then(() => setSaveError(null))
      .catch((error: unknown) => setSaveError(String(error)));
  }

  function next() {
    setResult(null);
    setIndex((i) => i + 1);
  }

  if (index >= questions.length) {
    return (
      <main>
        <h1>Done!</h1>
        <p className="score">
          {correctCount} / {questions.length} correct
        </p>
        <button autoFocus onClick={onExit}>
          Back to Today
        </button>
      </main>
    );
  }

  return (
    <main>
      <header className="test-header">
        <span>{test.title}</span>
        <span>
          {index + 1} / {questions.length}
        </span>
      </header>
      <QuestionView
        key={index}
        question={questions[index]}
        answered={result !== null}
        onAnswer={handleAnswer}
      />
      {result && <Feedback result={result} onNext={next} />}
      {saveError && (
        <p className="save-error">Could not save this answer: {saveError}</p>
      )}
    </main>
  );
}

type QuestionViewProps = {
  question: Question;
  answered: boolean;
  onAnswer: (result: GradeResult, answer: string) => void;
};

function QuestionView({ question, ...rest }: QuestionViewProps) {
  switch (question.template) {
    case 'multiple_choice':
      return <MultipleChoice question={question} {...rest} />;
    case 'reading':
      return <Reading question={question} {...rest} />;
  }
}
