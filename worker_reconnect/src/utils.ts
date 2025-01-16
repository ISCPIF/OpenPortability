export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomSleep(min: number, max: number): Promise<void> {
  const sleepTime = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(sleepTime);
}