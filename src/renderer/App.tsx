import { useState } from 'react';
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

  function handleAnswer(answer: GradeResult) {
    setResult(answer);
    if (answer.correct) setCorrectCount((count) => count + 1);
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
    </main>
  );
}

type QuestionViewProps = {
  question: Question;
  answered: boolean;
  onAnswer: (result: GradeResult) => void;
};

function QuestionView({ question, ...rest }: QuestionViewProps) {
  switch (question.template) {
    case 'multiple_choice':
      return <MultipleChoice question={question} {...rest} />;
    case 'reading':
      return <Reading question={question} {...rest} />;
  }
}
