import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { EventEmitter } from "events";
import { pipeline } from "node:stream/promises";
import { formatSize, drawProgressBar } from "./helpers.js";

const categories = {
	Documents: [".pdf", ".docx", ".doc", ".txt", ".md", ".xlsx", ".pptx"],
	Images: [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"],
	Archives: [".zip", ".rar", ".tar", ".gz", ".7z"],
	Code: [".js", ".py", ".java", ".cpp", ".html", ".css", ".json"],
	Videos: [".mp4", ".avi", ".mkv", ".mov", ".webm"],
	Other: [],
};

const createDefaultStats = () => ({
	Documents: 0,
	Images: 0,
	Archives: 0,
	Code: 0,
	Videos: 0,
	Other: 0,
	totalSize: 0,
});

class Organizer extends EventEmitter {
	async scan(sourceDirectory, targetDirectory) {
		const stats = createDefaultStats();

		try {
			await fsPromises.mkdir(targetDirectory, { recursive: true });
			await Promise.all(
				Object.keys(categories).map((category) =>
					fsPromises.mkdir(path.join(targetDirectory, category), { recursive: true }),
			),
			);

			const entries = await fsPromises.readdir(sourceDirectory, {
				withFileTypes: true,
				recursive: true,
			});

			const files = entries
				.filter((entry) => entry.isFile())
				.map((entry) => {
					const parentDir = entry.parentPath ?? entry.path ?? sourceDirectory;
					return path.join(parentDir, entry.name);
				});

			if (files.length === 0) {
				this.emit("copy-complete", { stats });
				return stats;
			}

			for (let index = 0; index < files.length; index++) {
				const sourcePath = files[index];
				const fileName = path.basename(sourcePath);
				const extension = path.extname(fileName).toLowerCase();
				const category = this.getCategoryByExtension(extension);
				const targetPath = path.join(targetDirectory, category, fileName);
				const uniqueTargetPath = await this.getUniqueTargetPath(targetPath);
				const { size } = await fsPromises.stat(sourcePath);

				this.emit("copy-start", {
					current: index + 1,
					total: files.length,
					category,
					fileName,
				});

				await this.copyFile(sourcePath, uniqueTargetPath, size);

				stats[category] += 1;
				stats.totalSize += size;

				this.emit("copy-complete", {
					current: index + 1,
					total: files.length,
					category,
					fileName,
					copiedPath: uniqueTargetPath,
				});
			}

			return stats;
		} catch (error) {
			if (error.code === "ENOENT") {
				console.error(`❌ Error: Directory not found: ${sourceDirectory}`);
			} else if (error.code === "EACCES") {
				console.error(`❌ Error: Permission denied: ${sourceDirectory}`);
			} else {
				console.error(`❌ Unexpected error: ${error.message}`);
			}
			process.exit(1);
		}
	}

	getCategoryByExtension(extension) {
		for (const [category, extensions] of Object.entries(categories)) {
			if (extensions.includes(extension)) {
				return category;
			}
		}
		return "Other";
	}

	async getUniqueTargetPath(targetPath) {
		let candidatePath = targetPath;
		let counter = 1;
		const { dir, name, ext } = path.parse(targetPath);

		while (true) {
			try {
				await fsPromises.access(candidatePath);
				candidatePath = path.join(dir, `${name}(${counter})${ext}`);
				counter += 1;
			} catch {
				return candidatePath;
			}
		}
	}

	async copyFile(sourcePath, targetPath, size) {
		if (size < 10 * 1024 * 1024) {
			await fsPromises.copyFile(sourcePath, targetPath);
			return;
		}

		await pipeline(fs.createReadStream(sourcePath), fs.createWriteStream(targetPath));
	}

	printStats(stats, targetDirectory) {
		const categoriesOrder = ["Documents", "Images", "Archives", "Code", "Videos", "Other"];
		const totalFiles = categoriesOrder.reduce((total, category) => total + stats[category], 0);
		const totalSize = formatSize(stats.totalSize);

		console.log("\nSummary:");
		categoriesOrder.forEach((category) => {
			const count = stats[category];
			console.log(`  ${category}: ${count} files → ${path.join(targetDirectory, category)}/`);
		});
		console.log(`\nTotal copied: ${totalFiles} files (${totalSize})`);
	}
}

export default async function main(sourceDirectory, outputDirectory) {
	try {
		const organizer = new Organizer();
		const targetDirectory = outputDirectory || path.join(process.cwd(), "Organized");

		console.log(`📦 Organizing: ${path.resolve(sourceDirectory)}`);
		console.log(`Target: ${path.resolve(targetDirectory)}`);
		console.log("\nCreating folders...");

		for (const category of Object.keys(categories)) {
			console.log(`  ✓ ${category}/`);
		}

		organizer.on("copy-start", ({ current, total }) => {
			process.stdout.write(`\r\x1b[2KCopying files... ${drawProgressBar(current, total)} files`);
		});

		organizer.on("copy-complete", ({ current, total }) => {
			process.stdout.write(`\r\x1b[2KCopying files... ${drawProgressBar(current, total)} files`);
		});

		const stats = await organizer.scan(sourceDirectory, targetDirectory);
		console.log("\n\n✅ Organization complete!");
		organizer.printStats(stats, targetDirectory);
	} catch (error) {
		console.error("Error:", error.message);
		process.exit(1);
	}
}
