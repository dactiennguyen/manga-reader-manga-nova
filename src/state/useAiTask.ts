import { useCallback, useEffect, useRef, useState } from 'react';

import { AiError, aiErrorMessage } from '../core/ai/port';

export type AiTaskState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; data: T }
  | { status: 'error'; message: string; code?: string };

export function useAiTask<T>() {
  const [state, setState] = useState<AiTaskState<T>>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);
  const run = useRef(0);

  const cancel = useCallback(() => {
    run.current += 1;
    controller.current?.abort();
    controller.current = null;
    setState({ status: 'idle' });
  }, []);

  const start = useCallback(async (task: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const id = ++run.current;
    setState({ status: 'loading' });
    try {
      const data = await task(current.signal);
      if (run.current !== id) {
        return null;
      }
      setState({ status: 'done', data });
      return data;
    } catch (error) {
      if (run.current !== id || (error instanceof AiError && error.code === 'cancelled')) {
        return null;
      }
      setState({
        status: 'error',
        message: aiErrorMessage(error),
        code: error instanceof AiError ? error.code : undefined,
      });
      return null;
    }
  }, []);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  useEffect(
    () => () => {
      run.current += 1;
      controller.current?.abort();
    },
    [],
  );

  return { state, start, cancel, reset };
}
