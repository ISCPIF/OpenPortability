class Worker {
  constructor() {
    throw new Error('worker_threads is not available in browser builds');
  }
}

module.exports = {
  Worker,
};
