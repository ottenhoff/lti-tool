/** Returns a shallow copy without properties whose value is `undefined`. */
export function pickDefined<T extends object>(input: T): Partial<T> {
  const output: Partial<T> = {};

  // SAFETY: Object.entries returns own enumerable string keys from input; assigning through
  // keyof T preserves those keys while the runtime guard removes only undefined values.
  for (const [key, value] of Object.entries(input) as Array<[keyof T, T[keyof T]]>) {
    if (value !== undefined) {
      output[key] = value;
    }
  }

  return output;
}
