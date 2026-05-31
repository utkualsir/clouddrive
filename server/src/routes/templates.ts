import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

interface Template {
  id: string;
  name: string;
  icon: string;
  category: string;
  extension: string;
  mimeType: string;
  content: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'blank-txt',
    name: 'Plain Text',
    icon: 'ti-file-text',
    category: 'Documents',
    extension: 'txt',
    mimeType: 'text/plain',
    content: '',
  },
  {
    id: 'blank-md',
    name: 'Markdown Document',
    icon: 'ti-markdown',
    category: 'Documents',
    extension: 'md',
    mimeType: 'text/markdown',
    content: '# Document Title\n\nStart writing here...\n',
  },
  {
    id: 'readme',
    name: 'README',
    icon: 'ti-brand-github',
    category: 'Documents',
    extension: 'md',
    mimeType: 'text/markdown',
    content:
      '# Project Name\n\n## Description\n\nA brief description of your project.\n\n## Installation\n\n```bash\nnpm install\n```\n\n## Usage\n\nDescribe how to use your project.\n\n## License\n\nMIT\n',
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    icon: 'ti-notes',
    category: 'Documents',
    extension: 'md',
    mimeType: 'text/markdown',
    content:
      '# Meeting Notes\n\n**Date:** \n**Attendees:** \n\n## Agenda\n\n1. \n2. \n\n## Discussion\n\n## Action Items\n\n- [ ] \n\n## Next Meeting\n\n',
  },
  {
    id: 'todo-list',
    name: 'To-Do List',
    icon: 'ti-checkbox',
    category: 'Documents',
    extension: 'md',
    mimeType: 'text/markdown',
    content:
      '# To-Do List\n\n## Today\n\n- [ ] Task 1\n- [ ] Task 2\n\n## This Week\n\n- [ ] Task 3\n\n## Someday\n\n- [ ] Task 4\n',
  },
  {
    id: 'blank-json',
    name: 'JSON File',
    icon: 'ti-braces',
    category: 'Code',
    extension: 'json',
    mimeType: 'application/json',
    content: '{\n  \n}\n',
  },
  {
    id: 'json-config',
    name: 'Config File',
    icon: 'ti-settings',
    category: 'Code',
    extension: 'json',
    mimeType: 'application/json',
    content:
      '{\n  "name": "",\n  "version": "1.0.0",\n  "description": "",\n  "settings": {\n    \n  }\n}\n',
  },
  {
    id: 'daily-journal',
    name: 'Daily Journal',
    icon: 'ti-book',
    category: 'Personal',
    extension: 'md',
    mimeType: 'text/markdown',
    content:
      "# Journal — {DATE}\n\n## How I'm feeling\n\n\n## What happened today\n\n\n## What I'm grateful for\n\n1. \n2. \n3. \n\n## Tomorrow's goals\n\n- [ ] \n",
  },
  {
    id: 'cv-template',
    name: 'CV / Resume',
    icon: 'ti-id-badge',
    category: 'Personal',
    extension: 'md',
    mimeType: 'text/markdown',
    content:
      '# Your Name\n\n**Email:** | **Phone:** | **Location:** | **LinkedIn:**\n\n---\n\n## Summary\n\nA brief professional summary.\n\n## Experience\n\n### Job Title — Company Name\n*Month Year – Present*\n- Achievement 1\n- Achievement 2\n\n## Education\n\n### Degree — University Name\n*Year – Year*\n\n## Skills\n\n- Skill 1, Skill 2, Skill 3\n',
  },
];

router.use(authenticateToken);

// GET /api/templates — return all templates without content
router.get('/', (_req: AuthRequest, res: Response): void => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  res.json({ success: true, data: TEMPLATES.map(({ content: _c, ...t }) => t) });
});

// POST /api/templates/:id/create
router.post('/:id/create', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { folderId, fileName } = req.body as { folderId?: string; fileName?: string };

    const template = TEMPLATES.find(t => t.id === id);
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }

    if (folderId) {
      const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } });
      if (!folder) { res.status(404).json({ success: false, error: 'Folder not found' }); return; }
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    // Replace {DATE} placeholder
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const content = template.content.replace(/\{DATE\}/g, dateStr);
    const contentBytes = Buffer.from(content, 'utf8');

    // Check storage limit
    const newStorageUsed = user.storageUsed + BigInt(contentBytes.length);
    if (newStorageUsed > user.storageLimit) {
      res.status(413).json({ success: false, error: 'Storage limit exceeded' });
      return;
    }

    // Build safe file name
    const baseName = (fileName?.trim() || template.name).replace(/[^a-zA-Z0-9._\- ]/g, '_');
    const finalName = `${baseName}.${template.extension}`;

    const uploadDir = process.env.UPLOAD_DIR ?? './uploads';
    const userDir = path.join(uploadDir, userId);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

    // Avoid filename collision
    let filePath = path.join(userDir, finalName);
    let suffix = 0;
    while (fs.existsSync(filePath)) {
      suffix++;
      filePath = path.join(userDir, `${baseName}_${suffix}.${template.extension}`);
    }
    const actualName = suffix === 0 ? finalName : `${baseName}_${suffix}.${template.extension}`;

    fs.writeFileSync(filePath, contentBytes);

    const file = await prisma.file.create({
      data: {
        name: actualName,
        originalName: actualName,
        mimeType: template.mimeType,
        size: BigInt(contentBytes.length),
        storagePath: filePath,
        folderId: folderId ?? null,
        userId,
        versionNumber: 1,
        currentVersion: 1,
      },
    });

    await prisma.user.update({ where: { id: userId }, data: { storageUsed: { increment: BigInt(contentBytes.length) } } });
    await prisma.activity.create({ data: { userId, action: 'created file from template', target: actualName } });

    res.status(201).json({
      success: true,
      data: { fileId: file.id, fileName: actualName, editorUrl: `/drive/edit/${file.id}` },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create file from template' });
  }
});

export default router;
