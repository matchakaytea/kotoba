import { useEffect, useState } from 'react';
import type { Session } from '../shared/api';
import type { GradeResult } from '../shared/grading';
import type { Question } from '../shared/test-schema';
import { Feedback } from './Feedback';
import { useI18n } from './i18n/i18n';
import { MultipleChoice } from './MultipleChoice';
import { Reading } from './Reading';

type Props = {
  session: Session;
  onExit: () => void;
};

export function TestRunner({ session, onExit }: Props) {
  const { t } = useI18n();
  const items = session.items;
  const questions = items.map((item) => item.question);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.isComposing) onExit();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onExit]);

  function handleAnswer(graded: GradeResult, answer: string) {
    setResult(graded);
    if (graded.correct) setCorrectCount((count) => count + 1);

    const { testId, questionIndex, question } = items[index];
    window.kotoba
      .saveAttempt({
        testId,
        questionIndex,
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

  const answered = index + (result ? 1 : 0);
  const progress = Math.round((answered / questions.length) * 100);

  if (index >= questions.length) {
    return (
      <div className="review">
        <div className="review-done">
          <p className="page-kicker">{t('review.title')}</p>
          <h1>{t('review.done')}</h1>
          <p className="score">
            {t('review.score', {
              correct: correctCount,
              total: questions.length,
            })}
          </p>
          <p className="page-sub">{t('review.doneSub')}</p>
          <button className="primary" autoFocus onClick={onExit}>
            {t('review.backToToday')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="review">
      <header className="review-header">
        <button className="back" title={t('review.backTitle')} onClick={onExit}>
          {t('review.back')}
        </button>
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={answered}
          aria-valuemin={0}
          aria-valuemax={questions.length}
        >
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <span className="review-count">
          {index + 1} / {questions.length}
        </span>
      </header>
      <div className="review-body">
        <QuestionView
          key={index}
          question={questions[index]}
          answered={result !== null}
          onAnswer={handleAnswer}
        />
        {result && <Feedback result={result} onNext={next} />}
        {saveError && (
          <p className="notice error">
            {t('review.saveError', { error: saveError })}
          </p>
        )}
      </div>
    </div>
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
