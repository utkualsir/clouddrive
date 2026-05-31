import { Router, Request, Response } from 'express';

const router = Router();

const CHANGELOG = [
  {
    version: '2.0.0',
    date: '2025-05-01',
    type: 'major',
    title: 'Complete Redesign & Social Features',
    changes: [
      { type: 'new', text: 'Complete UI redesign with professional dark/light mode' },
      { type: 'new', text: 'Friend system and follow/follower system' },
      { type: 'new', text: 'Real-time messaging between users' },
      { type: 'new', text: 'Community forum with categories and threads' },
      { type: 'new', text: 'Detailed Facebook-style user profiles' },
      { type: 'new', text: 'File versioning — never lose your work' },
      { type: 'new', text: 'Folder sharing with permission levels' },
      { type: 'improved', text: 'WebSocket real-time activity feed' },
      { type: 'improved', text: 'Advanced search with filters' },
    ],
  },
  {
    version: '1.5.0',
    date: '2025-04-15',
    type: 'minor',
    title: 'Tools & AI Assistant',
    changes: [
      { type: 'new', text: 'File converter — JPG to PDF, DOCX to PDF' },
      { type: 'new', text: 'CloudAssistant AI chatbot' },
      { type: 'new', text: 'In-browser file editor for text, markdown, JSON, CSV' },
      { type: 'new', text: 'CloudRunner mini game' },
      { type: 'new', text: 'PWA support — install as desktop app' },
      { type: 'improved', text: 'File preview with custom video and audio player' },
    ],
  },
  {
    version: '1.2.0',
    date: '2025-04-01',
    type: 'minor',
    title: 'Security & Storage',
    changes: [
      { type: 'new', text: 'Two-factor authentication (2FA)' },
      { type: 'new', text: 'Login history and device tracking' },
      { type: 'new', text: 'Folder encryption with password protection' },
      { type: 'new', text: 'File sharing with expiry and password' },
      { type: 'new', text: 'Storage plans — upgrade up to 2TB' },
      { type: 'improved', text: 'Email notifications for all important events' },
    ],
  },
  {
    version: '1.0.0',
    date: '2025-03-15',
    type: 'major',
    title: 'Initial Release',
    changes: [
      { type: 'new', text: 'File upload, download, and management' },
      { type: 'new', text: 'Folder organization with colors' },
      { type: 'new', text: 'User authentication with JWT' },
      { type: 'new', text: 'Dark and light mode' },
      { type: 'new', text: 'Responsive design for all devices' },
      { type: 'new', text: '4 language support: English, Turkish, German, Hungarian' },
    ],
  },
];

router.get('/', (_req: Request, res: Response): void => {
  res.json({ success: true, data: CHANGELOG });
});

export default router;
