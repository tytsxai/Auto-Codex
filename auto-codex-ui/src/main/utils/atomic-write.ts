import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';

interface AtomicWriteOptions {
  encoding?: BufferEncoding;
  mode?: number;
}

export function atomicWriteFileSync(
  targetPath: string,
  data: string | Buffer,
  options: AtomicWriteOptions = {}
): void {
  const dir = path.dirname(targetPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  let fd: number | null = null;

  try {
    fd = openSync(tempPath, 'w', options.mode);
    writeFileSync(fd, data, { encoding: options.encoding });
    fsyncSync(fd);
    closeSync(fd);
    fd = null;
    renameSync(tempPath, targetPath);
  } catch (error) {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        // Best-effort cleanup
      }
    }
    try {
      unlinkSync(tempPath);
    } catch {
      // Best-effort cleanup
    }
    throw error;
  }
}
