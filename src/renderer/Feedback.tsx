import type { GradeResult } from '../shared/grading';

type Props = {
  result: GradeResult;
  onNext: () => void;
};

export function Feedback({ result, onNext }: Props) {
  return (
    <div className={result.correct ? 'feedback correct' : 'feedback wrong'}>
      <div className="feedback-text">
        {result.correct ? (
          <p className="feedback-title">✓ Correct</p>
        ) : (
          <>
            <p className="feedback-title">
              ✗ Answer: <strong lang="ja">{result.expected}</strong>
            </p>
            {result.hint && <p className="feedback-hint">{result.hint}</p>}
          </>
        )}
      </div>
      <button autoFocus onClick={onNext}>
        Next →
      </button>
    </div>
  );
}
