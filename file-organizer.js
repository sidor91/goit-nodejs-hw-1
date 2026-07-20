import scan from "./lib/scanner.js";
import duplicateFinder from "./lib/duplicateFinder.js";
import organize from "./lib/organizer.js";
import cleanup from "./lib/cleanup.js";

const [, , command, targetPath, ...restArgs] = process.argv;

const args = {};

for (let index = 0; index < restArgs.length; index += 1) {
	const arg = restArgs[index];

	if (arg.startsWith("--")) {
		if (arg.includes("=")) {
			const [key, value] = arg.split("=");
			args[key] = value;
			continue;
		}

		if (index + 1 < restArgs.length && !restArgs[index + 1].startsWith("--")) {
			args[arg] = restArgs[index + 1];
			index += 1;
		} else {
			args[arg] = true;
		}
	} else {
		args.positionals = args.positionals || [];
		args.positionals.push(arg);
	}
}

if (command === "scan") {
	scan(targetPath);
} else if (command === "duplicates") {
	duplicateFinder(targetPath);
} else if (command === "organize") {
	const outputDirectory = args["--output"];
	organize(targetPath, outputDirectory);
} else if (command === "cleanup") {
	const thresholdDays = Number(args["--older-than"] || 0);
	const confirm = Boolean(args["--confirm"]);
	cleanup(targetPath, thresholdDays, confirm);
} else {
	console.error("❌ Помилка: Невідома команда або команду не вказано.");
	console.log("Використання: node file-organizer.js <команда> <шлях>");
}