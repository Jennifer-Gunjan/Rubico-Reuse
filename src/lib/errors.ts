/**
 * Our own functions and triggers signal a message meant for a person by raising it plainly,
 * which Postgres reports as SQLSTATE P0001 ("raise_exception"). Everything else is the
 * database talking to developers: constraint names, column lists and the contents of the
 * failing row. None of that belongs on a screen, and PostgREST's `details` field repeats
 * the whole row, so it is never surfaced either.
 */
export const GENERIC_ERROR = "Something went wrong. Please try again.";

/** Postgres raises this code for a plain `raise exception '...'`. */
const AUTHORED = "P0001";

export type DbError = { code?: string; message?: string } | null | undefined;

export const userMessage = (e: DbError): string =>
  e?.code === AUTHORED && e.message?.trim() ? e.message : GENERIC_ERROR;
