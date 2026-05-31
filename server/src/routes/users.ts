import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';

function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    try {
      const secret = process.env.JWT_SECRET;
      if (secret) {
        const decoded = jwt.verify(token, secret) as { id: string; email: string; role: string };
        req.user = decoded;
      }
    } catch { /* ignore */ }
  }
  next();
}

const imageUpload = (maxMB: number) => multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxMB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  },
});

// GET /api/users/check-username?u=username
router.get('/check-username', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { u } = req.query as { u?: string };
    if (!u || u.trim().length === 0) { res.status(400).json({ success: false, error: 'Username required' }); return; }
    const username = u.trim().toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { username, id: { not: req.user!.id } },
      select: { id: true },
    });
    res.json({ success: true, data: { available: !existing } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Check failed' });
  }
});

// GET /api/users/referral — get own referral info
router.get('/referral', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, referralCount: true, bonusStorageGB: true },
    });
    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    res.json({
      success: true,
      data: {
        referralCode: user.referralCode ?? '',
        referralCount: user.referralCount,
        bonusStorageGB: user.bonusStorageGB,
        referralLink: user.referralCode ? `${frontendUrl}/register?ref=${user.referralCode}` : '',
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch referral info' });
  }
});

// GET /api/users/suggested — 12 random users excluding self, with isFollowing
router.get('/suggested', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const users = await prisma.user.findMany({
      where: { id: { not: userId } },
      select: { id: true, displayName: true, username: true, avatarColor: true, avatarUrl: true, occupation: true, location: true },
      take: 50,
    });
    // Shuffle and take 12
    const shuffled = users.sort(() => Math.random() - 0.5).slice(0, 12);
    const followedIds = new Set(
      (await prisma.follow.findMany({ where: { followerId: userId, followingId: { in: shuffled.map(u => u.id) } }, select: { followingId: true } })).map(f => f.followingId),
    );
    res.json({ success: true, data: shuffled.map(u => ({ ...u, isFollowing: followedIds.has(u.id) })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch suggested users' });
  }
});

// GET /api/users/search?q=query
router.get('/search', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { q } = req.query as { q?: string };
    if (!q || q.trim().length === 0) { res.json({ success: true, data: [] }); return; }
    const userId = req.user!.id;
    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
        OR: [
          { displayName: { contains: q } },
          { username: { contains: q } },
        ],
      },
      select: { id: true, displayName: true, username: true, avatarColor: true, avatarUrl: true, occupation: true, location: true },
      take: 20,
    });
    const followedIds = new Set(
      (await prisma.follow.findMany({ where: { followerId: userId, followingId: { in: users.map(u => u.id) } }, select: { followingId: true } })).map(f => f.followingId),
    );
    res.json({ success: true, data: users.map(u => ({ ...u, isFollowing: followedIds.has(u.id) })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

// POST /api/users/heartbeat
router.post('/heartbeat', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.user.update({ where: { id: req.user!.id }, data: { lastSeen: new Date() } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update heartbeat' });
  }
});

// GET /api/users/online
router.get('/online', async (_req: Request, res: Response): Promise<void> => {
  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000);
    const users = await prisma.user.findMany({
      where: { lastSeen: { gte: cutoff } },
      select: { displayName: true, avatarColor: true, username: true },
      orderBy: { lastSeen: 'desc' },
      take: 20,
    });
    res.json({ success: true, data: users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch online users' });
  }
});

// PUT /api/users/profile — update own profile (auth required)
router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const {
      displayName, username,
      bio, birthDate, gender, relationshipStatus,
      website, location, currentCity, hometown, country,
      occupation, company, school, university,
      hobbies, favoriteMusic, favoriteSports, favoriteTeam, languages,
      showBirthDate, showGender, showRelationship, showEmail,
      emailNotifications, newSigninAlerts, storageWarnings,
    } = req.body as {
      displayName?: string;
      username?: string;
      bio?: string;
      birthDate?: string | null;
      gender?: string;
      relationshipStatus?: string;
      website?: string;
      location?: string;
      currentCity?: string;
      hometown?: string;
      country?: string;
      occupation?: string;
      company?: string;
      school?: string;
      university?: string;
      hobbies?: string[];
      favoriteMusic?: string[];
      favoriteSports?: string[];
      favoriteTeam?: string;
      languages?: string[];
      showBirthDate?: boolean;
      showGender?: boolean;
      showRelationship?: boolean;
      showEmail?: boolean;
      emailNotifications?: boolean;
      newSigninAlerts?: boolean;
      storageWarnings?: boolean;
    };

    const data: Record<string, unknown> = {};

    if (displayName !== undefined) {
      if (!displayName.trim()) { res.status(400).json({ success: false, error: 'Display name cannot be empty' }); return; }
      data.displayName = displayName.trim();
    }

    if (username !== undefined) {
      const trimmed = username.trim().toLowerCase();
      if (!trimmed) { res.status(400).json({ success: false, error: 'Username cannot be empty' }); return; }
      const existing = await prisma.user.findFirst({ where: { username: trimmed, id: { not: userId } }, select: { id: true } });
      if (existing) { res.status(400).json({ success: false, error: 'Username is already taken' }); return; }
      data.username = trimmed;
    }

    if (bio !== undefined) data.bio = bio || null;
    if (birthDate !== undefined) data.birthDate = birthDate ? new Date(birthDate) : null;
    if (gender !== undefined) data.gender = gender || null;
    if (relationshipStatus !== undefined) data.relationshipStatus = relationshipStatus || null;
    if (website !== undefined) data.website = website || null;
    if (location !== undefined) data.location = location || null;
    if (currentCity !== undefined) data.currentCity = currentCity || null;
    if (hometown !== undefined) data.hometown = hometown || null;
    if (country !== undefined) data.country = country || null;
    if (occupation !== undefined) data.occupation = occupation || null;
    if (company !== undefined) data.company = company || null;
    if (school !== undefined) data.school = school || null;
    if (university !== undefined) data.university = university || null;
    if (hobbies !== undefined) data.hobbies = JSON.stringify(hobbies ?? []);
    if (favoriteMusic !== undefined) data.favoriteMusic = JSON.stringify(favoriteMusic ?? []);
    if (favoriteSports !== undefined) data.favoriteSports = JSON.stringify(favoriteSports ?? []);
    if (favoriteTeam !== undefined) data.favoriteTeam = favoriteTeam || null;
    if (languages !== undefined) data.languages = JSON.stringify(languages ?? []);
    if (showBirthDate !== undefined) data.showBirthDate = showBirthDate;
    if (showGender !== undefined) data.showGender = showGender;
    if (showRelationship !== undefined) data.showRelationship = showRelationship;
    if (showEmail !== undefined) data.showEmail = showEmail;
    if (emailNotifications !== undefined) data.emailNotifications = emailNotifications;
    if (newSigninAlerts !== undefined) data.newSigninAlerts = newSigninAlerts;
    if (storageWarnings !== undefined) data.storageWarnings = storageWarnings;

    const user = await prisma.user.update({ where: { id: userId }, data });
    res.json({ success: true, data: { ...user, storageUsed: user.storageUsed.toString(), storageLimit: user.storageLimit.toString() } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// POST /api/users/avatar — upload avatar (auth required)
router.post('/avatar', authenticateToken, imageUpload(5).single('avatar'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ success: false, error: 'No image uploaded' }); return; }
    const userId = req.user!.id;
    const sharp = (await import('sharp')).default;
    const avatarsDir = path.join(UPLOAD_DIR, 'avatars');
    if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
    const avatarPath = path.join(avatarsDir, `${userId}.jpg`);
    await sharp(req.file.buffer).resize(400, 400, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(avatarPath);
    const avatarUrl = `/api/users/${userId}/avatar`;
    await prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
    res.json({ success: true, data: { avatarUrl } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to upload avatar' });
  }
});

// POST /api/users/cover — upload cover photo (auth required)
router.post('/cover', authenticateToken, imageUpload(10).single('cover'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ success: false, error: 'No image uploaded' }); return; }
    const userId = req.user!.id;
    const sharp = (await import('sharp')).default;
    const coversDir = path.join(UPLOAD_DIR, 'covers');
    if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
    const coverPath = path.join(coversDir, `${userId}.jpg`);
    await sharp(req.file.buffer).resize(1200, 400, { fit: 'cover' }).jpeg({ quality: 85 }).toFile(coverPath);
    const coverPhotoUrl = `/api/users/${userId}/cover`;
    await prisma.user.update({ where: { id: userId }, data: { coverPhotoUrl } });
    res.json({ success: true, data: { coverPhotoUrl } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to upload cover photo' });
  }
});

// PUT /api/users/onboarding — update onboarding step/completed
router.put('/onboarding', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { step, completed } = req.body as { step?: number; completed?: boolean };
    const data: Record<string, unknown> = {};
    if (step !== undefined) data.onboardingStep = step;
    if (completed !== undefined) data.onboardingCompleted = completed;
    await prisma.user.update({ where: { id: req.user!.id }, data });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update onboarding' });
  }
});

// PUT /api/users/email-notifications — update notification preference
router.put('/email-notifications', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { emailNotifications } = req.body as { emailNotifications: boolean };
    await prisma.user.update({ where: { id: req.user!.id }, data: { emailNotifications } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update notification preference' });
  }
});

// GET /api/users/login-history
router.get('/login-history', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const history = await prisma.loginHistory.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json({ success: true, data: history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch login history' });
  }
});

// DELETE /api/users/login-history
router.delete('/login-history', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.loginHistory.deleteMany({ where: { userId: req.user!.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to clear login history' });
  }
});

// GET /api/users/search-history
router.get('/search-history', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { searchHistory: true } });
    const history: string[] = user ? JSON.parse(user.searchHistory || '[]') : [];
    res.json({ success: true, data: history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch search history' });
  }
});

// PUT /api/users/search-history — prepend query, deduplicate, keep max 10
router.put('/search-history', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { query } = req.body as { query?: string };
    if (!query || !query.trim()) { res.status(400).json({ success: false, error: 'Query required' }); return; }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { searchHistory: true } });
    const existing: string[] = user ? JSON.parse(user.searchHistory || '[]') : [];
    const trimmed = query.trim();
    const updated = [trimmed, ...existing.filter(q => q !== trimmed)].slice(0, 10);
    await prisma.user.update({ where: { id: req.user!.id }, data: { searchHistory: JSON.stringify(updated) } });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update search history' });
  }
});

// DELETE /api/users/search-history — clear all
router.delete('/search-history', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.user.update({ where: { id: req.user!.id }, data: { searchHistory: '[]' } });
    res.json({ success: true, data: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to clear search history' });
  }
});

// DELETE /api/users/search-history/:query — remove specific entry
router.delete('/search-history/:query', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const queryToRemove = decodeURIComponent(req.params.query);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { searchHistory: true } });
    const existing: string[] = user ? JSON.parse(user.searchHistory || '[]') : [];
    const updated = existing.filter(q => q !== queryToRemove);
    await prisma.user.update({ where: { id: req.user!.id }, data: { searchHistory: JSON.stringify(updated) } });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to remove search history entry' });
  }
});

// GET /api/users/:id/avatar — serve avatar image (public)
router.get('/:id/avatar', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    // Check new flat path first, fall back to legacy per-user path
    const newPath = path.join(UPLOAD_DIR, 'avatars', `${id}.jpg`);
    const legacyPath = path.join(UPLOAD_DIR, id, 'avatars', 'avatar.jpg');
    const avatarPath = fs.existsSync(newPath) ? newPath : fs.existsSync(legacyPath) ? legacyPath : null;
    if (!avatarPath) { res.status(404).json({ success: false, error: 'Avatar not found' }); return; }
    res.sendFile(path.resolve(avatarPath));
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to serve avatar' });
  }
});

// GET /api/users/:id/cover — serve cover photo (public)
router.get('/:id/cover', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const coverPath = path.join(UPLOAD_DIR, 'covers', `${id}.jpg`);
    if (!fs.existsSync(coverPath)) { res.status(404).json({ success: false, error: 'Cover not found' }); return; }
    res.sendFile(path.resolve(coverPath));
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to serve cover photo' });
  }
});

// GET /api/users/:id/profile — public profile (privacy-aware)
router.get('/:id/profile', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requesterId = req.user?.id;
    const isOwn = requesterId === id;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { badges: { orderBy: { earnedAt: 'asc' } } },
    });

    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    // Increment profileViews for visitors (fire-and-forget, don't block response)
    if (!isOwn) {
      prisma.user.update({ where: { id }, data: { profileViews: { increment: 1 } } }).catch(console.error);
    }

    const [totalFiles, followerCount, followingCount, isFollowingRecord] = await Promise.all([
      prisma.file.count({ where: { userId: id, isTrashed: false } }),
      prisma.follow.count({ where: { followingId: id } }),
      prisma.follow.count({ where: { followerId: id } }),
      requesterId && !isOwn
        ? prisma.follow.findUnique({ where: { followerId_followingId: { followerId: requesterId, followingId: id } } })
        : Promise.resolve(null),
    ]);

    const parseJson = (s: string): string[] => { try { return JSON.parse(s) as string[]; } catch { return []; } };

    const profile: Record<string, unknown> = {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl,
      coverPhotoUrl: user.coverPhotoUrl,
      bio: user.bio,
      location: user.location,
      currentCity: user.currentCity,
      hometown: user.hometown,
      country: user.country,
      website: user.website,
      occupation: user.occupation,
      company: user.company,
      school: user.school,
      university: user.university,
      hobbies: parseJson(user.hobbies),
      favoriteMusic: parseJson(user.favoriteMusic),
      favoriteSports: parseJson(user.favoriteSports),
      favoriteTeam: user.favoriteTeam,
      languages: parseJson(user.languages),
      createdAt: user.createdAt,
      badges: user.badges,
      totalFiles,
      storageUsed: user.storageUsed.toString(),
      profileViews: isOwn ? user.profileViews : user.profileViews + 1,
      followerCount,
      followingCount,
      isFollowing: !!isFollowingRecord,
    };

    if (isOwn || user.showEmail) profile.email = user.email;
    if (isOwn || user.showBirthDate) profile.birthDate = user.birthDate;
    if (isOwn || user.showGender) profile.gender = user.gender;
    if (isOwn || user.showRelationship) profile.relationshipStatus = user.relationshipStatus;

    if (isOwn) {
      profile.showBirthDate = user.showBirthDate;
      profile.showGender = user.showGender;
      profile.showRelationship = user.showRelationship;
      profile.showEmail = user.showEmail;
      profile.storageLimit = user.storageLimit.toString();
      profile.emailNotifications = user.emailNotifications;
      profile.newSigninAlerts = user.newSigninAlerts;
      profile.storageWarnings = user.storageWarnings;
    }

    res.json({ success: true, data: profile });
  } catch (err) {
    console.error('GET /:id/profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST /api/users/:id/follow — toggle follow
router.post('/:id/follow', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const followerId = req.user!.id;
    const followingId = req.params.id;

    if (followerId === followingId) { res.status(400).json({ success: false, error: 'Cannot follow yourself' }); return; }

    const target = await prisma.user.findUnique({ where: { id: followingId }, select: { id: true, displayName: true } });
    if (!target) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });

    let isFollowing: boolean;
    if (existing) {
      await prisma.follow.delete({ where: { followerId_followingId: { followerId, followingId } } });
      isFollowing = false;
    } else {
      await prisma.follow.create({ data: { followerId, followingId } });
      isFollowing = true;

      // Notify the followed user
      const followerUser = await prisma.user.findUnique({ where: { id: followerId }, select: { displayName: true } });
      const { createNotification, NotificationType } = await import('../services/notificationService');
      createNotification(
        followingId,
        followerId,
        NotificationType.FOLLOW,
        `${followerUser?.displayName ?? 'Someone'} started following you`,
        `/profile/${followerId}`,
      ).catch(console.error);
    }

    const followerCount = await prisma.follow.count({ where: { followingId } });
    res.json({ success: true, data: { following: isFollowing, followerCount } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Follow action failed' });
  }
});

// GET /api/users/:id/followers
router.get('/:id/followers', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requesterId = req.user?.id;
    const follows = await prisma.follow.findMany({
      where: { followingId: id },
      include: { follower: { select: { id: true, displayName: true, username: true, avatarColor: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const followerIds = follows.map(f => f.followerId);
    let myFollowSet = new Set<string>();
    if (requesterId) {
      const myFollows = await prisma.follow.findMany({
        where: { followerId: requesterId, followingId: { in: followerIds } },
        select: { followingId: true },
      });
      myFollowSet = new Set(myFollows.map(f => f.followingId));
    }

    const data = follows.map(f => ({ ...f.follower, isFollowing: myFollowSet.has(f.follower.id) }));
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch followers' });
  }
});

// GET /api/users/:id/following
router.get('/:id/following', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requesterId = req.user?.id;
    const follows = await prisma.follow.findMany({
      where: { followerId: id },
      include: { following: { select: { id: true, displayName: true, username: true, avatarColor: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const followingIds = follows.map(f => f.followingId);
    let myFollowSet = new Set<string>();
    if (requesterId) {
      const myFollows = await prisma.follow.findMany({
        where: { followerId: requesterId, followingId: { in: followingIds } },
        select: { followingId: true },
      });
      myFollowSet = new Set(myFollows.map(f => f.followingId));
    }

    const data = follows.map(f => ({ ...f.following, isFollowing: myFollowSet.has(f.following.id) }));
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch following' });
  }
});

// GET /api/users/:id/friends-list — public friends list for a user's profile
router.get('/:id/friends-list', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ fromUserId: id }, { toUserId: id }],
      },
      include: {
        fromUser: { select: { id: true, displayName: true, username: true, avatarColor: true, avatarUrl: true, occupation: true } },
        toUser:   { select: { id: true, displayName: true, username: true, avatarColor: true, avatarUrl: true, occupation: true } },
      },
    });
    const friends = friendships.map(f => f.fromUserId === id ? f.toUser : f.fromUser);
    res.json({ success: true, data: friends });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch friends list' });
  }
});

// GET /api/users/:id/public-files — files visible based on privacy settings
router.get('/:id/public-files', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requesterId = req.user?.id;
    const isOwn = requesterId === id;

    let visibilityFilter: string[];

    if (isOwn) {
      visibilityFilter = ['PUBLIC', 'FRIENDS', 'PRIVATE'];
    } else if (requesterId) {
      // Check if requester is a friend or follower of file owner
      const [friendship, follow] = await Promise.all([
        prisma.friendship.findFirst({
          where: {
            status: 'ACCEPTED',
            OR: [
              { fromUserId: requesterId, toUserId: id },
              { fromUserId: id, toUserId: requesterId },
            ],
          },
        }),
        prisma.follow.findFirst({
          where: { followerId: requesterId, followingId: id },
        }),
      ]);
      visibilityFilter = friendship || follow ? ['PUBLIC', 'FRIENDS'] : ['PUBLIC'];
    } else {
      visibilityFilter = ['PUBLIC'];
    }

    const files = await prisma.file.findMany({
      where: { userId: id, isTrashed: false, parentFileId: null, visibility: { in: visibilityFilter } },
      select: {
        id: true, name: true, originalName: true, mimeType: true, size: true, visibility: true,
        shareToken: true, shareViews: true, downloadCount: true, createdAt: true, thumbnailPath: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const data = files.map(f => ({ ...f, size: f.size.toString() }));
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch public files' });
  }
});

export default router;
