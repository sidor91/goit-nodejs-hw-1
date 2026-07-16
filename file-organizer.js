import scan from "./lib/scanner.js";

const command = process.argv[2];
const targetPath = process.argv[3];

if (command === "scan") {
	scan(targetPath);
} else if (command === "duplicates") {
	console.log("Функція пошуку дублікатів ще не реалізована");
} else {
	console.error("❌ Помилка: Невідома команда або команду не вказано.");
	console.log("Використання: node file-organizer.js <команда> <шлях>");
}