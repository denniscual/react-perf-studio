import React, { useLayoutEffect } from "react";
import { shallow } from "zustand/shallow";

export type ContextSelectorProps<
  ContextValue,
  SelectorResult,
  T = React.ReactNode
> = {
  Context: React.Context<ContextValue>;
  selector: (contextValue: NonNullable<ContextValue>) => SelectorResult;
  children: (selectorResult: SelectorResult) => T;
  deps?: React.DependencyList;
};

export type MultiContextSelectorProps<
  Contexts extends React.Context<any>[],
  SelectorResult,
  T = React.ReactNode
> = {
  Context: [...Contexts];
  selector: (
    ...contextValues: {
      [K in keyof Contexts]: NonNullable<React.ContextType<Contexts[K]>>;
    }
  ) => SelectorResult;
  children: (selectorResult: SelectorResult) => T;
  deps?: React.DependencyList;
};

/**
 * A hook that enables consuming specific parts of context values to prevent unnecessary
 * re-renders when only those parts change.
 * NOTE: useContextSelector triggers Component-level rerender. If you don't want the Component to rerender, use ContextSelector.
 *
 * @param Context - A single React Context or an array of React Contexts. If using multiple contexts,
 *                  the order of Contexts must be maintained between renders.
 * @param selector - Function to extract specific values from the context(s)
 * @param calculateValue - The function calculating the selector result that you want to cache.
 * @param dependencies - The list of all reactive values referenced inside of the calculateValue code. Reactive values
 *               include props, state, and all the variables and functions declared directly inside your component body.
 *               If your linter is configured for React, it will verify that every reactive value is correctly
 *               specified as a dependency. The list of dependencies must have a constant number of items and be
 *               written inline like [dep1, dep2, dep3]. React will compare each dependency with its previous
 *               value using the Object.is comparison algorithm.
 * @returns The memoized rendered content
 */
// Single context case
function useContextSelector<ContextValue, SelectorResult, T>(
  Context: ContextSelectorProps<ContextValue, SelectorResult, T>["Context"],
  selector: ContextSelectorProps<ContextValue, SelectorResult, T>["selector"],
  calculateValue: ContextSelectorProps<
    ContextValue,
    SelectorResult,
    T
  >["children"],
  dependencies?: ContextSelectorProps<ContextValue, SelectorResult, T>["deps"]
): T;
// Multiple contexts case
function useContextSelector<
  Contexts extends React.Context<any>[],
  SelectorResult,
  T
>(
  Contexts: MultiContextSelectorProps<Contexts, SelectorResult, T>["Context"],
  selector: MultiContextSelectorProps<Contexts, SelectorResult, T>["selector"],
  calculateValue: MultiContextSelectorProps<
    Contexts,
    SelectorResult,
    T
  >["children"],
  dependencies?: MultiContextSelectorProps<Contexts, SelectorResult, T>["deps"]
): T;

function useContextSelector<T>(
  Contexts: React.Context<any> | React.Context<any>[],
  selector: (...args: any[]) => any,
  calculateValue: (selectorResult: any) => T,
  dependencies: React.DependencyList = []
): T {
  const isMultipleContexts = Array.isArray(Contexts);

  const contextValues = isMultipleContexts
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      (Contexts as React.Context<any>[]).map((ctx) => React.useContext(ctx))
    : // eslint-disable-next-line react-hooks/rules-of-hooks
      [React.useContext(Contexts as React.Context<any>)];

  // Check for null/undefined values
  contextValues.forEach((value, index) => {
    if (value === null || value === undefined) {
      const contextName = isMultipleContexts
        ? (Contexts as React.Context<any>[])[index].displayName ||
          `Context at index ${index}`
        : (Contexts as React.Context<any>).displayName || "Context";

      throw new Error(
        `${contextName} used in useContextSelector cannot be null or undefined. You must wrap your component in a Provider.`
      );
    }
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedCalculateValueFn = React.useCallback(
    calculateValue,
    dependencies
  );

  const prevResultRef = React.useRef<any>(null);
  const newResult = isMultipleContexts
    ? selector(...contextValues)
    : selector(contextValues[0]);
  // Shallow equality check is performed to determine whether to call the `calculateValue`.
  const nextResult = !shallow(prevResultRef.current, newResult)
    ? newResult
    : prevResultRef.current;

  useLayoutEffect(() => {
    prevResultRef.current = nextResult;
  }, [nextResult]);

  return React.useMemo(
    () => memoizedCalculateValueFn(nextResult),
    [nextResult, memoizedCalculateValueFn]
  );
}

/**
 * ContextSelector enables consuming specific parts of Context(s) values to achieve fine-grained reactivity.
 * The ContextSelector is best suited when you need to react to something within the UI of your component.
 * ContextSelector doesn't trigger component-level re-renders.
 *
 * @param {React.Context<any>|React.Context<any>[]} props.Context - Single Context or array of Contexts to consume
 * @param {Function} props.selector - Function that extracts values from the context(s)
 * @param {Function} props.children - Render prop that receives the selected value
 * @param {React.DependencyList} [props.deps] - Optional dependency array for memoizing the children render prop.
 */
// Single context case
function ContextSelector<ContextValue, SelectorResult>(
  props: ContextSelectorProps<ContextValue, SelectorResult>
): React.ReactElement;
// Multiple contexts case
function ContextSelector<Contexts extends React.Context<any>[], SelectorResult>(
  props: MultiContextSelectorProps<Contexts, SelectorResult>
): React.ReactElement;

function ContextSelector({
  Context,
  selector,
  children,
  deps,
}: {
  Context: React.Context<any> | React.Context<any>[];
  selector: (...args: any[]) => any;
  children: (selectorResult: any) => React.ReactNode;
  deps?: React.DependencyList;
}) {
  return useContextSelector(Context as any, selector, children, deps);
}

export { ContextSelector, useContextSelector };
