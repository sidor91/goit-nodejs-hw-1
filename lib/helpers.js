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