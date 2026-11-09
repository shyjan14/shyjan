import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

const ALLOWED: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
};
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Private file storage on local disk (swap for S3 with signed URLs in production).
 * Files are stored under <UPLOAD_DIR>/<employeeId>/<uuid>.<ext> and are only served
 * through the authenticated /files endpoint, never as public static files.
 */
@Injectable()
export class StorageService {
  private root = path.resolve(process.env.UPLOAD_DIR ?? './uploads');

  async save(employeeId: string, file: Express.Multer.File | undefined, kinds: string[] = Object.keys(ALLOWED)): Promise<string> {
    if (!file) throw new BadRequestException('File is required');
    if (!kinds.includes(file.mimetype) || !ALLOWED[file.mimetype]) throw new BadRequestException('Unsupported file type');
    if (file.size > MAX_BYTES) throw new BadRequestException('File is larger than 5 MB');
    if (!this.magicOk(file.buffer, file.mimetype)) throw new BadRequestException('File content does not match its type');
    const dir = path.join(this.root, employeeId);
    await fs.mkdir(dir, { recursive: true });
    const name = `${randomUUID()}${ALLOWED[file.mimetype]}`;
    await fs.writeFile(path.join(dir, name), file.buffer, { mode: 0o600 });
    return `${employeeId}/${name}`;
  }

  resolve(key: string): string {
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|pdf)$/.test(key)) throw new NotFoundException();
    return path.join(this.root, key);
  }

  private magicOk(buf: Buffer, mime: string) {
    if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8;
    if (mime === 'image/png') return buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    if (mime === 'application/pdf') return buf.subarray(0, 4).toString() === '%PDF';
    return false;
  }
}
