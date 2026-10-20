// Import Internal Dependencies
import { BenchmarkError } from "./BenchmarkError.ts";

export async function failOnBenchmarkError<TResult>(
  action: () => Promise<TResult>
): Promise<TResult | null> {
  try {
    return await action();
  }
  catch (error) {
    if (error instanceof BenchmarkError) {
      console.error(error.message);
      process.exitCode = 1;

      return null;
    }
    throw error;
  }
}
