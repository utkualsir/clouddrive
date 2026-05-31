import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { AuthRequest } from './auth';
import { ALLOWED_MIME_TYPES } from '../utils/helpers';

const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id ?? 'unknown';
    const uploadDir = path.join(process.env.UPLOAD_DIR ?? './uploads', userId);

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE) || 104857600,
  },
});
