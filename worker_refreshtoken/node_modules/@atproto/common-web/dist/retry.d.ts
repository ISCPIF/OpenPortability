export type RetryOptions = {
    maxRetries?: number;
    getWaitMs?: (n: number) => number | null;
};
export declare function retry<T>(fn: () => Promise<T>, opts?: RetryOptions & {
    retryable?: (err: unknown) => boolean;
}): Promise<T>;
export declare function createRetryable(retryable: (err: unknown) => boolean): <T>(fn: () => Promise<T>, opts?: RetryOptions) => Promise<T>;
export declare function backoffMs(n: number, multiplier?: number, max?: number): number;
//# sourceMappingURL=retry.d.ts.map