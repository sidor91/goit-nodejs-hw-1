import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { EventEmitter } from "events";
import { formatSize, drawProgressBar, getFileWord, getDiffInDays } from "./helpers.js";
import { stat } from "node:fs";

const createDefaultStats = () => ({
	totalDirs: 0,
	totalSize: 0,
	extensions: {},
	modified: {
		"Last 7 days": 0,
		"Last 30 days": 0,
		"Older than 90": 0,
	},
	oldestModified: {
		name: "",
		diffInDays: 0,
	},
	largestFiles: [],
	files: [],
});

class Scanner extends EventEmitter {
	async scan(directory) {
		const stats = createDefaultStats();
		try {
			this.emit("scan-start", { directory });
			const entries = await fs.readdir(directory, { withFileTypes: true, recursive: true });

			entries.forEach((entry) => {
				if (entry.isDirectory()) {
					stats.totalDirs++;
				} else if (entry.isFile()) {
					stats.files.push(entry);
				}
			});

			for (let i = 1; i <= stats.files.length; i++ ) {
        const entry = stats.files[i-1];
				const parentDir = entry.parentPath ?? entry.path ?? directory;
				const fullPath = path.join(parentDir, entry.name);

				const { size: fileSize, mtime } = await fs.stat(fullPath);

				this.emit("file-found", { current: i, total: stats.files.length });
				stats.totalSize += fileSize;

				const diffInDays = getDiffInDays(mtime);

				if (diffInDays <= 7) {
					stats.modified["Last 7 days"]++;
				} else if (diffInDays <= 30) {
					stats.modified["Last 30 days"]++;
				} else if (diffInDays > 90) {
					stats.modified["Older than 90"]++;
				}

				if (!stats.oldestModified.name || stats.oldestModified.diffInDays < diffInDays) {
					stats.oldestModified.name = entry.name;
					stats.oldestModified.diffInDays = diffInDays;
				}

				const ext = path.extname(entry.name) || "without extension";
				if (!stats.extensions[ext]) {
					stats.extensions[ext] = { count: 0, size: 0 };
				}
				stats.extensions[ext].count++;
				stats.extensions[ext].size += fileSize;

				stats.largestFiles.push({
					name: entry.name,
					path: fullPath,
					size: fileSize,
				});
			}

			stats.largestFiles.sort((a, b) => b.size - a.size);
			stats.largestFiles = stats.largestFiles.slice(0, 3);

			this.emit("scan-complete", { stats });

      delete stats.files;

			return stats;
		} catch (error) {
			if (error.code === "ENOENT") {
				console.error(`❌ Error: Directory not found: ${directory}`);
			} else if (error.code === "EACCES") {
				console.error(`❌ Error: Permission denied: ${directory}`);
			} else {
				console.error(`❌ Unexpected error: ${error.message}`);
			}
			process.exit(1);
		}
	}

	printStats(stats) {
		console.log(" ");
		console.log("\n 📊 Scan Results:");
		console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
		console.log(`- Total files: ${stats.files.length}`);
		console.log(`- Total size: ${formatSize(stats.totalSize)}\n`);

		if (Object.entries(stats.extensions).length) {
			console.log("By File Type:");
			const sortedExts = Object.entries(stats.extensions)
				.sort(([, a], [, b]) => b.count - a.count)
				.slice(0, 5);
			const otherExt = Object.entries(stats.extensions).slice(5);
			const otherExtStats = otherExt.reduce(
				(acc, [_, data]) => {
					acc.totalSize += data.size;
					acc.totalCount += data.count;
					return acc;
				},
				{ totalSize: 0, totalCount: 0 },
			);

			for (const [ext, data] of sortedExts) {
				console.log(`- ${ext}: ${data.count} ${getFileWord(data.count)} (${formatSize(data.size)})`);
			}
			console.log(
				`- other: ${otherExtStats.totalCount} ${getFileWord(otherExtStats.totalCount)} (${formatSize(otherExtStats.totalSize)})`,
			);
		}

		if (stats.modified && Object.entries(stats.modified).some(([, number]) => number)) {
			console.log("\nFile Age:");
			for (const [key, value] of Object.entries(stats.modified)) {
				console.log(`${key}: ${value}`);
			}
		}

		if (stats.largestFiles.length > 0) {
			console.log("\nLargest files:");
			stats.largestFiles.forEach((file, index) => {
				console.log(`${index + 1}. ${file.name} - ${formatSize(file.size)}`);
			});
		}

		if (stats.oldestModified.name) {
			console.log(
				`\nOldest file: ${stats.oldestModified.name} (modified ${Math.floor(stats.oldestModified.diffInDays)} days ago)`,
			);
		}
	}
}

export default async function main(targetPath) {
  try {
		const scanner = new Scanner();

		scanner.once("scan-start", ({ directory }) => {
			console.log(`📂 Scanning: ${path.resolve(directory)}`);
		});

		scanner.on("file-found", ({ current, total }) => {
			process.stdout.write(`\r Processing... ${drawProgressBar(current, total)} files`);
		});

		scanner.on("scan-complete", ({ stats }) => {
			scanner.printStats(stats);
		});

		await scanner.scan(targetPath);
	} catch (error) {
		console.error("Error:", error.message);
		process.exit(1);
	}
}
