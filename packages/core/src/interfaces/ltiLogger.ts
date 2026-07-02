export type LtiLogFields = Readonly<Record<string, unknown>>;

export type LtiLogMethod = {
  (message: string): void;
  (fields: LtiLogFields): void;
  (fields: LtiLogFields, message: string): void;
};

/** Minimal structured logger surface used by LTI tool internals and adapters. */
export type LtiLogger = {
  readonly debug: LtiLogMethod;
  readonly info: LtiLogMethod;
  readonly warn: LtiLogMethod;
  readonly error: LtiLogMethod;
};
