import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { EventEmitter } from "events";
import { formatSize, drawProgressBar, getFileWord, getDiffInDays, calculateHash } from "./helpers.js";
import { stat } from "node:fs";

class DuplicateFinder extends EventEmitter {
	async scan(directory) {
		const filePaths = [];
		const hashMap = new Map();
		try {
			const entries = await fs.readdir(directory, { withFileTypes: true, recursive: true });

			for (const entry of entries) {
				if (entry.isFile()) {
					const parentDir = entry.parentPath ?? entry.path ?? directory;
					const fullPath = path.join(parentDir, entry.name);
					filePaths.push(fullPath);
				}
			}

			if (filePaths.length === 0) {
				this.emit("duplicates-found", { result: [] });
				return [];
			}

			let processedCount = 0;

			for (const path of filePaths) {
				try {
					const [hash, { size }] = await Promise.all([calculateHash(path), fs.stat(path)]);
					if (!hashMap.has(hash)) {
						hashMap.set(hash, [{ path, size }]);
					} else {
						hashMap.get(hash).push({ path, size });
					}
				} catch (error) {
					//
				}
				processedCount++;
				this.emit("file-processed", { current: processedCount, total: filePaths.length });
			}

			const duplicates = [];
			for (const [hash, data] of hashMap.entries()) {
				if (data.length > 1) {
					duplicates.push({
						hash,
						eachSize: data[0].size,
						totalWastedSize: data[0].size * (data.length - 1),
						filePaths: data.map((element) => element.path).join(","),
					});
				}
			}

			this.emit("duplicates-found", { result: duplicates });
			return duplicates;
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

	printStats(results) {
		if (!results.length) {
			console.log("\nFound 0 duplicates");
			return;
		}

		const totalWastedSize = results.reduce((acc, item) => (acc += item.totalWastedSize), 0);
    const formattedTotalWastedSize = formatSize(totalWastedSize);
    console.log('');
		console.log(`\nFound ${results.length} duplicate groups (${formattedTotalWastedSize} wasted):`);

		results.forEach((item, idx) => {
      const pathArray = item.filePaths.split(',');
			console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
			console.log(`\nGroup ${idx + 1} (${pathArray.length} copies, ${formatSize(item.eachSize)} each):`);
			console.log(`\nSHA-256: ${item.hash.slice(0, 12)}...`);
			console.log("");
			pathArray.forEach((itemPath) => {
				console.log(`\n📄 ${itemPath}`);
			});
			console.log("");
			console.log(`\nWasted space: ${formatSize(item.totalWastedSize)}`);
		});

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`💾 Total wasted space: ${formattedTotalWastedSize}`);
	}
}

export default async function main(targetPath) {
	try {
		const duplicateFinder = new DuplicateFinder();

		console.log(`🔍 Searching for duplicates in: \n${targetPath}`);

		duplicateFinder.on("file-processed", ({ current, total }) => {
			process.stdout.write(`\rCalculating hashes... ${drawProgressBar(current, total)} files`);
		});

		duplicateFinder.on("duplicates-found", ({ result }) => {
			duplicateFinder.printStats(result);
		});

		await duplicateFinder.scan(targetPath);
	} catch (error) {
		console.error("Error:", error.message);
		process.exit(1);
	}
}
