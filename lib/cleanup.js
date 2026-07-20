import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { EventEmitter } from "events";
import { formatSize, drawProgressBar } from "./helpers.js";

class Cleanup extends EventEmitter {
	async cleanup(directory, thresholdDays, shouldDelete) {
		const filesToDelete = [];
		const now = Date.now();

		try {
			const entries = await fs.readdir(directory, { withFileTypes: true, recursive: true });

			for (let index = 0; index < entries.length; index += 1) {
				const entry = entries[index];
				if (!entry.isFile()) {
					continue;
				}

				const parentDir = entry.parentPath ?? entry.path ?? directory;
				const filePath = path.join(parentDir, entry.name);
				const stats = await fs.stat(filePath);
				const fileAgeInDays = (now - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

				this.emit("file-found", {
					current: index + 1,
					total: entries.length,
					filePath,
					stats,
					daysOld: fileAgeInDays,
				});

				if (fileAgeInDays > thresholdDays) {
					filesToDelete.push({ filePath, stats, daysOld: fileAgeInDays });
				}
			}

			if (!shouldDelete) {
				this.emit("cleanup-complete", { filesToDelete, deleted: false, dryRun: true });
				return filesToDelete;
			}

			for (let index = 0; index < filesToDelete.length; index += 1) {
				const file = filesToDelete[index];
				await fs.unlink(file.filePath);
				this.emit("file-deleted", {
					current: index + 1,
					total: filesToDelete.length,
					filePath: file.filePath,
					stats: file.stats,
				});
			}

			this.emit("cleanup-complete", { filesToDelete, deleted: true, dryRun: false });
			return filesToDelete;
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

	printStats(filesToDelete, shouldDelete) {
		const totalSize = filesToDelete.reduce((acc, file) => acc + file.stats.size, 0);
		const totalFiles = filesToDelete.length;
		console.log(`\nFound ${totalFiles} files to delete:`);
		console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

		filesToDelete.forEach((file) => {
			console.log(path.basename(file.filePath));
			console.log(`  Size: ${formatSize(file.stats.size)}`);
			console.log(`  Modified: ${Math.floor(file.daysOld)} days ago (${file.stats.mtime.toISOString().slice(0, 10)})`);
		});

		console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
		console.log(`Total: ${totalFiles} files (${formatSize(totalSize)})`);

		if (!shouldDelete) {
			console.log("\n⚠️  DRY RUN MODE: No files were deleted.");
			console.log("To actually delete these files, run with --confirm flag.");
			return;
		}

		console.log(`\n⚠️  DELETING ${totalFiles} files (${formatSize(totalSize)}). This action cannot be undone!`);
	}
}

export default async function main(directory, thresholdDays, shouldDelete = false) {
	try {
		const cleanup = new Cleanup();
		console.log(`🧹 Cleanup: ${path.resolve(directory)}`);
		console.log(`Looking for files older than ${thresholdDays} days...\n`);

		cleanup.on("file-found", ({ current, total, filePath }) => {
			process.stdout.write(`\r\x1b[2KChecking... ${drawProgressBar(current, total)} ${path.basename(filePath)}`);
		});

		cleanup.on("file-deleted", ({ current, total, filePath }) => {
			process.stdout.write(`\r\x1b[2KDeleting... ${drawProgressBar(current, total)} ${path.basename(filePath)}`);
		});

		const filesToDelete = await cleanup.cleanup(directory, thresholdDays, shouldDelete);
		cleanup.printStats(filesToDelete, shouldDelete);
	} catch (error) {
		console.error("Error:", error.message);
		process.exit(1);
	}
}
