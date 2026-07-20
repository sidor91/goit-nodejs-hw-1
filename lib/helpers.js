import crypto from "crypto";
import fs from "fs";

export function drawProgressBar(current, total, width = 20) {
	const percentage = current / total;
	const filled = Math.round(percentage * width);
	const bar = "█".repeat(filled) + "░".repeat(width - filled);
	return `${bar} ${current}/${total}`;
}

export function formatSize(bytes) {
	if (bytes === 0) return "0 B";

	const units = ["B", "KB", "MB", "GB"];
	const k = 1024;
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

export function getFileWord(count) {
	return count === 1 ? "file" : "files";
}

export function getDiffInDays(date) {
	const now = new Date();
	const mtimeDate = new Date(date);

	const diffInMs = now - mtimeDate;
	return diffInMs / (1000 * 60 * 60 * 24); // 1000ms * 60s * 60m * 24h
}

export function calculateHash(filePath) {
	return new Promise((resolve, reject) => {
		const hash = crypto.createHash("sha256");
		const stream = fs.createReadStream(filePath);

		stream.on("data", (chunk) => hash.update(chunk));
		stream.on("end", () => resolve(hash.digest("hex")));
		stream.on("error", reject);
	});
}
