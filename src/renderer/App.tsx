import { useEffect, useState } from 'react';
import type { Summary } from '../shared/api';
import type { GradeResult } from '../shared/grading';
import type { Question } from '../shared/test-schema';
import { Feedback } from './Feedback';
import { MultipleChoice } from './MultipleChoice';
import { Reading } from './Reading';
import { sampleTest } from './sample-test';

export function App() {
  const questions = sampleTest.questions;
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
        testId: sampleTest.test_id,
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

  function restart() {
    setResult(null);
    setIndex(0);
    setCorrectCount(0);
  }

  if (index >= questions.length) {
    return (
      <main>
        <h1>Done!</h1>
        <p className="score">
          {correctCount} / {questions.length} correct
        </p>
        <AllTimeSummary />
        <button autoFocus onClick={restart}>
          Start again
        </button>
      </main>
    );
  }

  return (
    <main>
      <header className="test-header">
        <span>{sampleTest.title}</span>
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

function AllTimeSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    window.kotoba.getSummary().then(setSummary);
  }, []);

  if (!summary) return null;
  return (
    <p className="all-time">
      All time: {summary.correct} / {summary.attempts} answers correct,{' '}
      {summary.targets} words practised
    </p>
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
