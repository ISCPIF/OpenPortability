export declare const readFromGenerator: <T>(gen: AsyncGenerator<T>, isDone: (last?: T) => Promise<boolean> | boolean, waitFor?: Promise<unknown>, maxLength?: number) => Promise<T[]>;
export type Deferrable = {
    resolve: () => void;
    complete: Promise<void>;
};
export declare const createDeferrable: () => Deferrable;
export declare const createDeferrables: (count: number) => Deferrable[];
export declare const allComplete: (deferrables: Deferrable[]) => Promise<void>;
export declare class AsyncBuffer<T> {
    maxSize?: number | undefined;
    private buffer;
    private promise;
    private resolve;
    private closed;
    private toThrow;
    constructor(maxSize?: number | undefined);
    get curr(): T[];
    get size(): number;
    get isClosed(): boolean;
    resetPromise(): void;
    push(item: T): void;
    pushMany(items: T[]): void;
    events(): AsyncGenerator<T>;
    throw(err: unknown): void;
    close(): void;
}
export declare class AsyncBufferFullError extends Error {
    constructor(maxSize: number);
}
/**
 * Utility function that behaves like {@link Promise.allSettled} but returns the
 * same result as {@link Promise.all} in case every promise is fulfilled, and
 * throws an {@link AggregateError} if there are more than one errors.
 */
export declare function allFulfilled<T extends readonly unknown[] | []>(promises: T): Promise<{
    -readonly [P in keyof T]: Awaited<T[P]>;
}>;
export declare function allFulfilled<T>(promises: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>[]>;
export declare function handleAllSettledErrors<T extends readonly PromiseSettledResult<unknown>[] | []>(results: T): {
    -readonly [P in keyof T]: T[P] extends PromiseSettledResult<infer U> ? U : never;
};
export declare function handleAllSettledErrors<T>(results: PromiseSettledResult<T>[]): T[];
export declare function isRejectedResult(result: PromiseSettledResult<unknown>): result is PromiseRejectedResult;
export declare function isFulfilledResult<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T>;
//# sourceMappingURL=async.d.ts.map