import type { GradeResult } from '../shared/grading';

type Props = {
  result: GradeResult;
  onNext: () => void;
};

export function Feedback({ result, onNext }: Props) {
  return (
    <div className={result.correct ? 'feedback correct' : 'feedback wrong'}>
      {result.correct ? (
        <p>✓ Correct</p>
      ) : (
        <>
          <p>
            ✗ Answer: <strong>{result.expected}</strong>
          </p>
          {result.hint && <p className="hint">{result.hint}</p>}
        </>
      )}
      <button autoFocus onClick={onNext}>
        Next →
      </button>
    </div>
  );
}
