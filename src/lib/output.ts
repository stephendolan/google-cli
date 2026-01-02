let compactOutput = false;

export function setOutputOptions(options: { compact: boolean }): void {
  compactOutput = options.compact;
}

export function outputJson(data: unknown): void {
  const json = compactOutput ? JSON.stringify(data) : JSON.stringify(data, null, 2);
  console.log(json);
}
