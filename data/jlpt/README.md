# JLPT vocabulary

Source: [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks)
by Jamie Sinclair (MIT, see `LICENSE`), based on the JLPT word lists by
Jonathan Waller (tanos.co.uk, released under Creative Commons BY).

These are unofficial lists. The JLPT has not published official vocabulary
lists since 2010.

`n1.csv` to `n5.csv` are unmodified copies of the source files.
`npm run build:vocab` merges them into the Vocabulary list
(`src/main/vocab/entries.json`), with the rules in `src/main/vocab/merge.ts`:

- A word already in the deck (`../eggrolls`), written and read the same, is
  the same word. When the two lists disagree on its level, the deck wins.
- A word read the same but spelled differently (美味しい / おいしい,
  入口 / 入り口) becomes another spelling of the deck word, so search and
  review progress work with either.
- Every other word is added as a new entry, with its level and English
  meaning from this list.

`chinese.tsv` holds Simplified and Traditional (Taiwan) Chinese meanings for
the added words, translated from the English. If the build reports words
without one, list them with `npm run build:vocab -- --todo todo.tsv`, add
their translations to `chinese.tsv`, and build again.
