import chalk from "chalk";
import { createConsola } from "consola";

const logger = createConsola({
  formatOptions: {
    colors: true,
    date: false,
    compact: false
  }
});

export function setVerboseMode(enabled: boolean): void {
  logger.level = enabled ? 4 : 3;
}

export const log = {
  info: (message: string) => logger.info(chalk.cyan(message)),
  success: (message: string) => logger.success(chalk.green.bold(message)),
  warn: (message: string) => logger.warn(chalk.yellow(message)),
  error: (message: string) => logger.error(chalk.red.bold(message)),
  debug: (message: string) => logger.debug(chalk.dim(message))
};
