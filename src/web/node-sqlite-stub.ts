// The web build never opens a database through Node; this stands in for
// node:sqlite so shared code that imports it can still be bundled.
export class DatabaseSync {
  constructor() {
    throw new Error('node:sqlite is not available in the browser.');
  }
}
