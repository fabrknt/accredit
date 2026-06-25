declare const console: {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode?: number;
};
