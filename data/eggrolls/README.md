# JLPT vocabulary with Chinese meanings

Source: [anki-jlpt-decks](https://github.com/5mdld/anki-jlpt-decks) by
egg rolls (蛋卷), commit `853798a` (2026-09-24). Traditional Chinese content by
ShihHsing Chen.

Licence: [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)
(see `LICENSE`). **Non-commercial use only.** If Kotoba is ever sold or used in
a paid product, this data has to be removed.

`notes.csv` is an unmodified copy of `deck-source/notes.csv`.

Changes made for Kotoba, by `npm run build:vocab` into
`src/main/vocab/entries.json`:

- Audio fields removed.
- Furigana kept in Anki's `漢字[かな]` format and shown as ruby text.
- For katakana words, the reading column holds the source word (for example
  `kilogram`); it is kept as an origin note and the word itself is used as the
  reading.
- HTML tags removed from meanings.
