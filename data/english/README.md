# English meanings for the vocabulary list

`npm run build:vocab` gives every word in `src/main/vocab/entries.json` an
English meaning (`meaningEn`), taken from:

1. `meanings.tsv` here, if the word's id is in it. These 5,274 meanings were
   translated into English from the deck's Chinese meanings (see
   `../eggrolls`), so they share its licence:
   [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/),
   non-commercial use only.
2. Otherwise, the JLPT word list in `../jlpt` (Jonathan Waller, CC BY) for the
   same word and reading.

The build fails if any word ends up without an English meaning.

`meanings.tsv` columns: id (the deck's note id), expression, reading, English.
Edit the English column to fix a meaning, then run `npm run build:vocab`.
