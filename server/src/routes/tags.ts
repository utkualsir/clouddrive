import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

// GET /api/tags — list all tags for current user with file count
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tags = await prisma.tag.findMany({
      where: { userId: req.user!.id },
      include: { _count: { select: { files: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: tags.map(t => ({ ...t, fileCount: t._count.files })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch tags' });
  }
});

// POST /api/tags — create tag
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, color } = req.body as { name?: string; color?: string };
    if (!name || !name.trim()) { res.status(400).json({ success: false, error: 'Tag name required' }); return; }
    if (name.trim().length > 20) { res.status(400).json({ success: false, error: 'Tag name max 20 chars' }); return; }
    if (color && !HEX_RE.test(color)) { res.status(400).json({ success: false, error: 'Invalid color' }); return; }
    const tag = await prisma.tag.create({
      data: { name: name.trim(), color: color ?? '#6366f1', userId: req.user!.id },
      include: { _count: { select: { files: true } } },
    });
    res.status(201).json({ success: true, data: { ...tag, fileCount: 0 } });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      res.status(400).json({ success: false, error: 'Tag name already exists' });
    } else {
      console.error(err);
      res.status(500).json({ success: false, error: 'Failed to create tag' });
    }
  }
});

// PUT /api/tags/:id — update name or color
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, color } = req.body as { name?: string; color?: string };
    const existing = await prisma.tag.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) { res.status(404).json({ success: false, error: 'Tag not found' }); return; }
    const data: Record<string, string> = {};
    if (name !== undefined) {
      if (!name.trim()) { res.status(400).json({ success: false, error: 'Tag name required' }); return; }
      if (name.trim().length > 20) { res.status(400).json({ success: false, error: 'Tag name max 20 chars' }); return; }
      data.name = name.trim();
    }
    if (color !== undefined) {
      if (!HEX_RE.test(color)) { res.status(400).json({ success: false, error: 'Invalid color' }); return; }
      data.color = color;
    }
    const tag = await prisma.tag.update({ where: { id: req.params.id }, data, include: { _count: { select: { files: true } } } });
    res.json({ success: true, data: { ...tag, fileCount: tag._count.files } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update tag' });
  }
});

// DELETE /api/tags/:id — delete tag and all FileTag associations
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await prisma.tag.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!existing) { res.status(404).json({ success: false, error: 'Tag not found' }); return; }
    await prisma.tag.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to delete tag' });
  }
});

export default router;
