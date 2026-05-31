import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import os from 'os';
import path from 'path';
import fs from 'fs';
import 'dotenv/config';

import authRoutes from './routes/auth';
import folderRoutes from './routes/folders';
import fileRoutes from './routes/files';
import storageRoutes from './routes/storage';
import reviewRoutes from './routes/reviews';
import userRoutes from './routes/users';
import shareRoutes from './routes/share';
import adminRoutes from './routes/admin';
import toolRoutes from './routes/tools';
import searchRoutes from './routes/search';
import statsRoutes from './routes/stats';
import friendRoutes from './routes/friends';
import paymentRoutes from './routes/payments';
import tagRoutes from './routes/tags';
import notificationRoutes from './routes/notifications';
import conversationRoutes from './routes/conversations';
import forumRoutes, { seedForumCategories } from './routes/forum';
import templateRoutes from './routes/templates';
import changelogRoutes from './routes/changelog';
import { setupWebSocket } from './websocket';

const app = express();
const PORT = process.env.PORT ?? 3001;
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';

function getLocalIP(): string {
  const ifaces = os.networkInterfaces();
  for (const iface of Object.values(ifaces)) {
    for (const addr of iface ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return 'localhost';
}

for (const dir of [UPLOAD_DIR, `${UPLOAD_DIR}/avatars`, `${UPLOAD_DIR}/covers`, `${UPLOAD_DIR}/thumbs`]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/changelog', changelogRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

const server = http.createServer(app);
setupWebSocket(server);

seedForumCategories().catch(err => console.error('Forum seed error:', err));

server.listen(Number(PORT), '0.0.0.0', () => {
  const localIP = getLocalIP();
  console.info(`CloudDrive server running — Local: http://localhost:${PORT}  Network: http://${localIP}:${PORT}`);
  console.info(`Upload directory: ${path.resolve(UPLOAD_DIR)}`);
});

export default app;
