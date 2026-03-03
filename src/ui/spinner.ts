import ora, { Ora, Options } from "ora";
import chalk from "chalk";

/**
 * Creates a standard cloud-meter spinner to maintain consistent UI feel
 * across the CLI.
 */
export function createSpinner(options?: Options | string): Ora {
  return ora({
    ...((typeof options === 'string' ? { text: options } : options) || {}),
    spinner: "dots", // Standardized to classic dots
    color: "cyan",
  });
}

/**
 * Helper to display a successful step.
 */
export function succeedSpinner(spinner: Ora, text: string) {
  spinner.succeed(chalk.green(text));
}

/**
 * Helper to display a failed step.
 */
export function failSpinner(spinner: Ora, text: string) {
  spinner.fail(chalk.red(text));
}
