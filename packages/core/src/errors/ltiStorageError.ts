/**
 * Stable storage conflict error for adapter operations that cannot complete because
 * an equivalent record already exists.
 */
export class LtiStorageConflictError extends Error {
  readonly operation: string;
  readonly cause?: unknown;

  constructor(input: {
    readonly operation: string;
    readonly message: string;
    readonly cause?: unknown;
  }) {
    super(input.message);
    this.name = 'LtiStorageConflictError';
    this.operation = input.operation;
    if (input.cause !== undefined) this.cause = input.cause;
  }
}
