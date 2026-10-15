import type { GradeResult } from '../shared/grading';
import { useI18n } from './i18n/i18n';

type Props = {
  result: GradeResult;
  onNext: () => void;
};

export function Feedback({ result, onNext }: Props) {
  const { t } = useI18n();
  return (
    <div className={result.correct ? 'feedback correct' : 'feedback wrong'}>
      <div className="feedback-text">
        {result.correct ? (
          <p className="feedback-title">{t('feedback.correct')}</p>
        ) : (
          <>
            <p className="feedback-title">
              {t('feedback.answer')}{' '}
              <strong lang="ja">{result.expected}</strong>
            </p>
            {result.hint && (
              <p className="feedback-hint">{t(`hint.${result.hint}`)}</p>
            )}
          </>
        )}
      </div>
      <button autoFocus onClick={onNext}>
        {t('feedback.next')}
      </button>
    </div>
  );
}
