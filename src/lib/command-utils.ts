import { handleError } from './errors.js';

type AsyncActionFn<T extends unknown[]> = (...args: T) => Promise<void>;

export function withErrorHandling<T extends unknown[]>(
  fn: AsyncActionFn<T>
): (...args: T) => Promise<void> {
  return async function (this: unknown, ...args: T) {
    try {
      await fn.call(this, ...args);
    } catch (error) {
      handleError(error);
    }
  };
}
