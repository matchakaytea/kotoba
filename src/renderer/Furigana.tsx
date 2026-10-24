import { parseFurigana } from '../shared/furigana';

/** Anki furigana such as `妹[いもうと]は<b> 高校[こうこう]</b>` as ruby text. */
export function Furigana({ source }: { source: string }) {
  return (
    <>
      {parseFurigana(source).map((part, j) =>
        part.ruby ? (
          <ruby key={j} className={part.target ? 'target' : undefined}>
            {part.text}
            <rt>{part.ruby}</rt>
          </ruby>
        ) : (
          <span key={j} className={part.target ? 'target' : undefined}>
            {part.text}
          </span>
        ),
      )}
    </>
  );
}
