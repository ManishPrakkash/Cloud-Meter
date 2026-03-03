import figlet from "figlet";
import gradient from "gradient-string";
import chalk from "chalk";

export function renderBrandBanner(): string {
  const ascii = figlet.textSync("Cloud Meter", {
    font: "Standard",
    horizontalLayout: "default",
    verticalLayout: "default"
  });

  const title = gradient.pastel.multiline(ascii);
  const subtitle = chalk.dim("Pagination Efficiency Analyzer · guided mode");

  return `${title}\n${subtitle}`;
}
