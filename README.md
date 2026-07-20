# File Organizer Utilities

This project provides four small Node.js CLI utilities for file analysis and cleanup:

- `scan` — inspect a directory and collect file statistics
- `duplicates` — find duplicate files by hash and show wasted space
- `organize` — copy files into category folders without deleting originals
- `cleanup` — list or delete files older than a selected age threshold

## Requirements

- Node.js 18+
- A filesystem path to scan or organize

## Installation

```sh
npm install
```

## Commands

### 1. Scan

Scans a directory recursively and prints summary statistics about:

- total files
- total size
- most common file extensions
- file age groups
- largest files
- oldest modified file

Usage:

```sh
node file-organizer.js scan /path/to/directory
```

Example:

```sh
node file-organizer.js scan /Users/student/Downloads
```

### 2. Duplicates

Searches a directory recursively and finds duplicate files by SHA-256 hash.
It then groups duplicates and shows:

- duplicate groups
- file count per group
- size of each file
- total wasted space

Usage:

```sh
node file-organizer.js duplicates /path/to/directory
```

Example:

```sh
node file-organizer.js duplicates /Users/student/Downloads
```

### 3. Organize

Copies files from a source directory into a target directory and sorts them into category folders:

- `Documents`
- `Images`
- `Archives`
- `Code`
- `Videos`
- `Other`

The source directory remains unchanged. Only copied files are created in the target directory.

If a target file already exists, the utility automatically creates a new name with a numeric suffix:

- `file.pdf`
- `file(1).pdf`
- `file(2).pdf`

Usage:

```sh
node file-organizer.js organize /source/directory --output /target/directory
```

Example:

```sh
node file-organizer.js organize /Users/student/Downloads --output /Users/student/Organized
```

### 4. Cleanup

Finds files older than a selected number of days based on their last modification time.

Behavior:

- Without `--confirm`: dry-run mode only, files are listed but not deleted
- With `--confirm`: files are actually deleted after the preview list

Usage:

```sh
node file-organizer.js cleanup /path/to/directory --older-than 90
```

Delete files for real:

```sh
node file-organizer.js cleanup /path/to/directory --older-than 90 --confirm
```

Example:

```sh
node file-organizer.js cleanup /Users/student/Downloads --older-than 90
```

## Notes

- `organize` uses category mapping based on file extension.
- Unknown extensions are placed into `Other`.
- Large files are copied using streams to avoid loading the entire file into memory.
- Small files are copied via `fs.copyFile()` for speed and simplicity.
- `cleanup` is safe by default because it previews the files before deletion.

## Typical NPM Scripts

You can also run the same commands through npm scripts:

```sh
npm run scan -- /path/to/directory
npm run duplicates -- /path/to/directory
npm run organize -- /path/to/directory --output /path/to/target
npm run cleanup -- /path/to/directory --older-than 90
```

## Example Workflow

```sh
node file-organizer.js scan /Users/student/Downloads
node file-organizer.js duplicates /Users/student/Downloads
node file-organizer.js organize /Users/student/Downloads --output /Users/student/Organized
node file-organizer.js cleanup /Users/student/Downloads --older-than 90
```
