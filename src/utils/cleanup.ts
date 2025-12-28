import fs from 'fs';
import path from 'path';
import { logger } from '../logger';
import { config } from '../config';

const MAX_AGE_HOURS = 24; // Delete files older than 24 hours
const MAX_FILES_KEEP = 10; // Keep at most 10 recent files

export function cleanupOldFiles(): void {
  cleanupDirectory(config.paths.data, ['debug-*.png']);
  cleanupDirectory(path.join(config.paths.data, 'videos'), ['*.webm']);
}

function cleanupDirectory(dirPath: string, patterns: string[]): void {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  try {
    const files = fs.readdirSync(dirPath);
    const now = Date.now();
    const maxAgeMs = MAX_AGE_HOURS * 60 * 60 * 1000;

    const matchingFiles: { name: string; path: string; mtime: number }[] = [];

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      
      // Check if file matches any pattern
      const matches = patterns.some(pattern => {
        const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
        return regex.test(file);
      });

      if (!matches) continue;

      try {
        const stats = fs.statSync(filePath);
        if (!stats.isFile()) continue;

        matchingFiles.push({
          name: file,
          path: filePath,
          mtime: stats.mtimeMs,
        });
      } catch {
        // Skip files we can't stat
      }
    }

    // Sort by modification time (newest first)
    matchingFiles.sort((a, b) => b.mtime - a.mtime);

    let deletedCount = 0;

    for (let i = 0; i < matchingFiles.length; i++) {
      const file = matchingFiles[i];
      const age = now - file.mtime;

      // Delete if: older than MAX_AGE_HOURS OR more than MAX_FILES_KEEP files
      if (age > maxAgeMs || i >= MAX_FILES_KEEP) {
        try {
          fs.unlinkSync(file.path);
          deletedCount++;
        } catch (err) {
          logger.warn({ err, file: file.name }, 'Failed to delete old file');
        }
      }
    }

    if (deletedCount > 0) {
      logger.info({ dirPath, deletedCount }, 'Cleaned up old files');
    }
  } catch (err) {
    logger.warn({ err, dirPath }, 'Failed to cleanup directory');
  }
}
