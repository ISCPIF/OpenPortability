class UnsupportedWorker {
  constructor() {
    throw new Error('worker_threads is not available in the browser runtime.');
  }
}

module.exports = {
  Worker: UnsupportedWorker,
  isMainThread: true,
  parentPort: null,
  workerData: null,
};
