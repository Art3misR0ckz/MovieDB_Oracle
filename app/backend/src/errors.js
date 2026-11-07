// Turns Oracle errors into short messages for the user.
//
// The important rules live in the database (constraints, trigger,
// procedures). The API does not repeat them; it only translates the
// error Oracle raises into something readable.

// ORA-00001 (unique constraint) and ORA-02290 (check constraint) name the
// constraint that failed, e.g. "(MOVIEDB.UQ_BSEAT_SHOW_SEAT)".
const CONSTRAINT_MESSAGES = {
  UQ_BSEAT_SHOW_SEAT: 'Sorry, one of those seats was just booked by someone else.',
  PK_BOOKING_SEAT: 'The same seat was selected twice.',
  UQ_SHOW_SCREEN_START: 'That screen already has a show starting at that time.',
  UQ_MOVIE_TITLE_DATE: 'A movie with this title and release date already exists.',
  PK_WATCHLIST: 'This movie is already on your watchlist.',
  PK_MOVIE_GENRE: 'The same genre was selected twice.',
  CK_REV_RATING: 'Rating must be between 0.5 and 5 in half-star steps.',
  CK_PAY_METHOD: 'Payment method must be UPI, CARD, NETBANKING or WALLET.',
  CK_MOVIE_DURATION: 'Duration must be between 30 and 300 minutes.',
  CK_MOVIE_CERTIFICATE: 'Certificate must be U, UA, A or S.',
  CK_SHOW_PRICE: 'Base price must be greater than 0.',
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function toHttpError(err) {
  if (err instanceof ApiError) return { status: err.status, message: err.message };

  const num = err.errorNum;
  const firstLine = String(err.message || '').split('\n')[0];

  // Our own RAISE_APPLICATION_ERROR codes (-20000 .. -20999): the message
  // was written for people already, just strip the "ORA-20xxx: " prefix.
  if (num >= 20000 && num <= 20999) {
    return { status: 409, message: firstLine.replace(/^ORA-\d+:\s*/, '') };
  }

  const constraint = (firstLine.match(/\(\w+\.(\w+)\)/) || [])[1];
  if (constraint && CONSTRAINT_MESSAGES[constraint]) {
    return { status: num === 1 ? 409 : 400, message: CONSTRAINT_MESSAGES[constraint] };
  }

  switch (num) {
    case 1:    return { status: 409, message: `Duplicate value (${constraint}).` };
    case 2290: return { status: 400, message: `Invalid value (${constraint}).` };
    case 2291: return { status: 400, message: `Referenced row does not exist (${constraint}).` };
    case 2292: return { status: 409, message: `Cannot delete: other rows depend on it (${constraint}).` };
    case 1400:
    case 1407: return { status: 400, message: 'A required field is missing.' };
    default:
      console.error(err);
      return { status: 500, message: 'Database error: ' + firstLine };
  }
}
