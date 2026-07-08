export type LtiHonoStatus =
  | 200
  | 400
  | 401
  | 403
  | 404
  | 409
  | 500
  | 501;

export type LtiHonoRedirectStatus = 301 | 302 | 303 | 307 | 308;

export type LtiHonoBodyValue = FormDataEntryValue | FormDataEntryValue[];

export type LtiHonoRequest = {
  readonly method: string;
  readonly path: string;
  readonly url: string;
  query(): Record<string, string>;
  query(key: string): string | undefined;
  formData(): Promise<FormData>;
  parseBody(options?: { readonly all?: boolean }): Promise<Record<string, LtiHonoBodyValue>>;
};

export type LtiHonoExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

export type LtiHonoContext = {
  readonly req: LtiHonoRequest;
  readonly executionCtx: LtiHonoExecutionContext;
  header(name: string, value: string): void;
  html(html: string, status?: LtiHonoStatus): Response | Promise<Response>;
  json(data: unknown, status?: LtiHonoStatus): Response;
  redirect(location: string | URL, status?: LtiHonoRedirectStatus): Response;
  text(text: string, status?: LtiHonoStatus): Response;
};

export type LtiHonoNext = () => Promise<void>;

export type LtiHonoHandler<TContext extends LtiHonoContext = LtiHonoContext> = (
  context: TContext,
  next: LtiHonoNext,
) => Response | Promise<Response>;
