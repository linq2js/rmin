import { useEffect, useRef, useState } from "react";

export type Store<TState, TProps> = {
  readonly props: (state: TState) => TProps;
  readonly initial: TState;
  readonly state: TState;
  readonly error: any;
  readonly loading: boolean;
  listen(listener: VoidFunction): VoidFunction;
} & {
  [key in keyof TProps]: TProps[key] extends Memo<infer T>
    ? T
    : TProps[key] extends (...args: infer TParams) => infer TResult
    ? (...args: TParams) => TResult extends Promise<any> ? Promise<void> : void
    : TProps[key];
};

export interface Create {
  <TState, TProps extends {}>(
    initial: TState,
    props: (state: TState, refs: Record<string, any>) => TProps
  ): Store<TState, TProps>;

  <TKey, TState, TProps extends {}>(
    props: (key: TKey) => Store<TState, TProps>
  ): {
    get(key: TKey): Store<TState, TProps> & { key: TKey; dispose(): void };
  };
}

class Memo<T> {
  constructor(
    public fn: (cache: Map<string, any>, key: string, fn: Function) => T
  ) {}
}

export function memo<T>(fn: () => T, deps: any[] = []): Memo<T> {
  return new Memo((cache: Map<string, any>, key: string) => {
    const prev = cache.get(key);
    if (prev && shallow(prev.deps, deps)) return prev.result;
    const result = fn();
    cache.set(key, { deps, result });
    return result;
  });
}

export const create: Create = (...args: any[]) => {
  let initial: any;
  let props: any;
  let factory: any;

  if (typeof args[0] === "function") {
    [factory] = args;
    const family = new Map<any, any>();
    return {
      get(key: any) {
        let store = family.get(key);
        if (!store) {
          store = factory(key);
          Object.assign(store, {
            key,
            dispose() {
              family.delete(key);
            },
          });
        }
        family.set(key, store);
        return store;
      },
    };
  }

  [initial, props] = args;

  if (typeof initial === "undefined") {
    throw new Error("Initial state cannot be undefined. Using null instead");
  }

  const listeners: VoidFunction[] = [];
  const refs = { asyncProcesses: 0, method: "" };
  const memoCache = new Map<string, any>();
  let state: any = initial;
  let buildProps: VoidFunction;
  let latestProps: any;
  let error: any;
  const store: any = {
    props,
    initial,
    get state() {
      return state;
    },
    get loading() {
      return refs.asyncProcesses > 0;
    },
    get error() {
      return error;
    },
    listen(listener: VoidFunction) {
      let active = true;
      listeners.push(listener);
      return () => {
        if (!active) return;
        active = false;
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      };
    },
  };

  function notify() {
    listeners.slice().forEach((x) => x());
  }

  function updateState(nextState: any) {
    if (typeof nextState === "undefined") return;
    if (typeof nextState?.then === "function") {
      const snapshot = state;
      refs.asyncProcesses++;
      nextState
        .then((result: any) => {
          // outdated
          if (snapshot !== state) return;
          updateState(result);
        })
        .catch((e: any) => {
          if (snapshot !== state) return;
          error = e;
          notify();
        })
        .finally(() => {
          refs.asyncProcesses--;
          if (!refs.asyncProcesses) {
            notify();
          }
        });
      if (refs.asyncProcesses === 1) {
        notify();
      }
    } else {
      if (nextState !== state) {
        state = nextState;
        buildProps();
        notify();
      }
    }
  }

  function buildLazyProp(key: string) {
    if (key in store) return;
    Object.defineProperty(store, key, {
      get() {
        error = undefined;
        refs.method = key;
        try {
          return latestProps[key].fn(memoCache, key);
        } catch (e) {
          error = e;
          notify();
        }
      },
    });
  }

  function buildMethod(key: string) {
    if (key in store) return;
    store[key] = (...args: any[]) => {
      error = undefined;
      refs.method = key;
      try {
        const result = latestProps[key](...args);
        updateState(result);
        return result;
      } catch (e) {
        error = e;
        notify();
      }
    };
  }

  buildProps = () => {
    latestProps = props(state, refs);
    Object.keys(latestProps).forEach((key) => {
      const value = latestProps[key];
      if (value instanceof Memo) {
        buildLazyProp(key);
      } else if (typeof value === "function") {
        buildMethod(key);
      } else {
        // static props
        store[key] = value;
      }
    });
  };

  buildProps();

  return store;
};

export function strict(a: any, b: any) {
  return a === b;
}

export function shallow(a: any, b: any) {
  if (a === b) return true;
  // handle falsy
  if ((a && !b) || (b && !a)) return false;
  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);
  if (aIsArray && bIsArray) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }
  if ((aIsArray && !bIsArray) || (bIsArray && !aIsArray)) {
    return false;
  }
  const aIsDate = a instanceof Date;
  const bIsDate = b instanceof Date;
  if (aIsDate && bIsDate) {
    return a.getTime() === b.getTime();
  }
  if ((aIsDate && !bIsDate) || (bIsDate && !aIsDate)) {
    return false;
  }
  if (typeof a === "object" && typeof b === "object") {
    for (const key in a) {
      if (a[key] !== b[key]) return false;
    }
    for (const key in b) {
      if (a[key] !== b[key]) return false;
    }
    return true;
  }
  return false;
}

export interface UseStore extends Function {
  <TState, TProps>(store: Store<TState, TProps>): TState;

  <TState, TProps, TResult>(
    store: Store<TState, TProps>,
    selector: (store: Store<TState, TProps>) => TResult,
    equalityComparer?: (a: TResult, b: TResult) => boolean
  ): TResult;
}

export const useStore: UseStore = (
  store: any,
  selector?: any,
  equalityComparer?: any
) => {
  const selectorRef = useRef<Function>();
  const prevStateRef = useRef<any>();
  const comparerRef = useRef<Function>();
  const errorRef = useRef<any>();
  const activeRef = useRef(true);
  const rerender = useState<any>()[1];
  const removeSuspenseListenerRef = useRef<Function>();

  selectorRef.current =
    selector ??
    ((store: Store<any, any>) => {
      if (store.error) throw store.error;
      if (store.loading) {
        removeSuspenseListenerRef.current?.();
        throw new Promise((resolve, reject) => {
          const unsubscribe = store.listen(() => {
            unsubscribe();
            if (store.error) {
              return reject(store.error);
            }
            return resolve(store.state);
          });
          removeSuspenseListenerRef.current = unsubscribe;
        });
      }
      return store.state;
    });
  comparerRef.current = equalityComparer ?? strict;
  activeRef.current = true;

  useEffect(
    () => () => {
      activeRef.current = false;
      removeSuspenseListenerRef.current?.();
    },
    []
  );

  useEffect(() => {
    activeRef.current = true;
    const handleChange = () => {
      if (!activeRef.current) return;
      try {
        const nextState = selectorRef.current!(store);
        const noChange = comparerRef.current!(nextState, prevStateRef.current);
        if (noChange) return;
      } catch (e) {
        errorRef.current = e;
      }
      rerender({});
    };
    return store.listen(handleChange);
  }, [store, rerender]);

  if (errorRef.current) {
    const error = errorRef.current;
    errorRef.current = undefined;
    throw error;
  }

  prevStateRef.current = selectorRef.current!(store);
  return prevStateRef.current;
};
