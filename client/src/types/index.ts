export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarColor: string;
  storageUsed: string;
  storageLimit: string;
  role: string;
  createdAt: string;
  lastSeen?: string;
  onboardingCompleted?: boolean;
  twoFactorEnabled?: boolean;
  emailNotifications?: boolean;
  plan?: string;
}

export interface LoginHistoryEntry {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  deviceName: string;
  browser: string;
  os: string;
  location: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  isEncrypted: boolean;
  parentId: string | null;
  userId: string;
  isStarred: boolean;
  isTrashed: boolean;
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  userId: string;
  fileCount?: number;
  createdAt: string;
}

export interface FileTagEntry {
  fileId: string;
  tagId: string;
  tag: Tag;
}

export type FileVisibility = 'PUBLIC' | 'FRIENDS' | 'PRIVATE';

export interface File {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: string;
  storagePath: string;
  thumbnailPath: string | null;
  folderId: string | null;
  userId: string;
  isStarred: boolean;
  isTrashed: boolean;
  trashedAt: string | null;
  downloadCount: number;
  viewCount: number;
  likeCount?: number;
  isLiked?: boolean;
  shareToken: string | null;
  shareExpires: string | null;
  shareViews: number;
  visibility: FileVisibility;
  parentFileId: string | null;
  versionNumber: number;
  versionCount: number;
  currentVersion: number;
  tags?: FileTagEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface FileVersion {
  id: string;
  fileId: string;
  versionNumber: number;
  storagePath: string;
  size: string;
  createdAt: string;
}

export interface FileVersionsData {
  currentVersion: number;
  versions: FileVersion[];
}

export interface StorageStats {
  storageUsed: string;
  storageLimit: string;
  storageUsedFormatted: string;
  storageLimitFormatted: string;
  percentage: number;
  breakdown: { mimeType: string; count: number; size: string; sizeFormatted: string }[];
  recentActivity: Activity[];
}

export interface Activity {
  id: string;
  userId: string;
  action: string;
  target: string;
  isRead: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  userId: string;
  displayName: string;
  avatarColor: string;
  memberSince: string;
  rating: number;
  comment: string;
  likes: number;
  hasLiked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewsData {
  reviews: Review[];
  total: number;
  page: number;
  pages: number;
  averageRating: number;
  totalCount: number;
}

export interface OnlineUser {
  displayName: string;
  avatarColor: string;
  username: string;
}

export interface ShareInfo {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: string;
  uploaderName: string;
  hasPassword: boolean;
  shareExpires: string | null;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalFiles: number;
  totalStorageUsed: string;
  filesUploadedToday: number;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarColor: string;
  storageUsed: string;
  storageLimit: string;
  role: string;
  fileCount: number;
  createdAt: string;
  lastSeen: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface SuggestedUser {
  id: string;
  displayName: string;
  username: string;
  avatarColor: string;
  avatarUrl: string | null;
  occupation: string | null;
  location: string | null;
  isFollowing: boolean;
}

export interface SearchResults {
  files: File[];
  folders: Folder[];
  users?: SuggestedUser[];
  threads?: ForumThread[];
}

export type ViewMode = 'grid' | 'list';
export type SortField = 'name' | 'createdAt' | 'size';
export type SortOrder = 'asc' | 'desc';
export type FileCategory = 'all' | 'image' | 'pdf' | 'video' | 'audio' | 'archive' | 'word' | 'excel' | 'powerpoint' | 'text';

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export interface StatsData {
  totalFiles: number;
  totalFolders: number;
  storageUsed: string;
  storageLimit: string;
  storageUsedFormatted: string;
  storageLimitFormatted: string;
  storagePercentage: number;
  filesByType: { type: string; count: number; size: number }[];
  uploadsByDay: { date: string; count: number; size: number }[];
  topFolders: { name: string; fileCount: number; size: number }[];
  recentActivity: Activity[];
  totalDownloads: number;
  totalSharedFiles: number;
  largestFiles: { id: string; name: string; originalName: string; mimeType: string; size: string; createdAt: string }[];
  mostViewedFiles: { id: string; name: string; mimeType: string; size: string; viewCount: number }[];
  mostDownloadedFiles: { id: string; name: string; mimeType: string; size: string; downloadCount: number }[];
  mostLikedFiles: { id: string; name: string; mimeType: string; size: string; likeCount: number }[];
}

export interface Badge {
  id: string;
  userId: string;
  type: string;
  earnedAt: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  username: string;
  avatarColor: string;
  avatarUrl: string | null;
  coverPhotoUrl: string | null;
  bio: string | null;
  location: string | null;
  currentCity: string | null;
  hometown: string | null;
  country: string | null;
  website: string | null;
  occupation: string | null;
  company: string | null;
  school: string | null;
  university: string | null;
  hobbies: string[];
  favoriteMusic: string[];
  favoriteSports: string[];
  favoriteTeam: string | null;
  languages: string[];
  createdAt: string;
  badges: Badge[];
  totalFiles: number;
  storageUsed: string;
  profileViews: number;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  // conditionally returned based on privacy settings
  email?: string;
  birthDate?: string | null;
  gender?: string | null;
  relationshipStatus?: string | null;
  // own-profile-only fields
  showBirthDate?: boolean;
  showGender?: boolean;
  showRelationship?: boolean;
  showEmail?: boolean;
  storageLimit?: string;
  emailNotifications?: boolean;
  newSigninAlerts?: boolean;
  storageWarnings?: boolean;
}

export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'FOLLOW'
  | 'FILE_SHARED'
  | 'FOLDER_SHARED'
  | 'FILE_COMMENT'
  | 'COMMENT_REPLY'
  | 'COMMENT_MENTION'
  | 'STORAGE_WARNING'
  | 'FORUM_REPLY'
  | 'FORUM_ANSWER'
  | 'NEW_MESSAGE'
  | 'SYSTEM';

export interface NotificationFrom {
  id: string;
  displayName: string;
  username: string;
  avatarColor: string;
  avatarUrl: string | null;
}

export interface AppNotification {
  id: string;
  userId: string;
  fromId: string | null;
  from: NotificationFrom | null;
  type: NotificationType;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface FollowUser {
  id: string;
  displayName: string;
  username: string;
  avatarColor: string;
  avatarUrl: string | null;
  isFollowing: boolean;
}

export interface PublicFile {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: string;
  visibility: FileVisibility;
  shareToken: string | null;
  shareViews: number;
  downloadCount: number;
  createdAt: string;
  thumbnailPath: string | null;
}

export interface FileComment {
  id: string;
  fileId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    displayName: string;
    avatarColor: string;
  };
}

export interface WsEvent {
  type: string;
  fileName?: string;
  folderName?: string;
  fileSize?: number;
  fileId?: string;
  userId?: string;
  displayName?: string;
  avatarColor?: string;
  timestamp?: string;
  notification?: AppNotification;
  conversationId?: string;
  message?: Message;
  x?: number;
  y?: number;
}

export interface FolderViewer {
  userId: string;
  displayName: string;
  avatarColor: string;
}

export interface LiveCursor {
  userId: string;
  displayName: string;
  avatarColor: string;
  x: number;
  y: number;
  lastSeen: number;
}

export interface ReferralInfo {
  referralCode: string;
  referralCount: number;
  bonusStorageGB: number;
  referralLink: string;
}

export interface MessageParticipant {
  id: string;
  displayName: string;
  username: string;
  avatarColor: string;
  avatarUrl: string | null;
}

export interface MessageAttachment {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender: MessageParticipant;
  content: string;
  attachmentId: string | null;
  attachment: MessageAttachment | null;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  participant: MessageParticipant | null;
  unreadCount: number;
}

// ─── Forum ───────────────────────────────────────────────────────────────────

export interface ForumAuthor {
  id: string;
  displayName: string;
  username: string;
  avatarColor: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface ForumCategoryLatestThread {
  id: string;
  title: string;
  lastPostAt: string;
  author: { displayName: string; username: string };
}

export interface ForumCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  createdAt: string;
  threadCount: number;
  latestThread: ForumCategoryLatestThread | null;
}

export interface ForumThreadCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface ForumThread {
  id: string;
  title: string;
  content: string;
  categoryId: string;
  category: ForumThreadCategory;
  authorId: string;
  author: ForumAuthor;
  views: number;
  isPinned: boolean;
  isLocked: boolean;
  isSolved: boolean;
  tags: string[];
  lastPostAt: string;
  lastPostBy: string | null;
  createdAt: string;
  updatedAt: string;
  postCount: number;
}

export interface ForumPost {
  id: string;
  content: string;
  threadId: string;
  authorId: string;
  author: ForumAuthor;
  isAnswer: boolean;
  likeCount: number;
  isLiked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ForumStats {
  threadCount: number;
  postCount: number;
  memberCount: number;
  onlineCount: number;
}

export interface ForumUserStats {
  threadCount: number;
  postCount: number;
}

export interface ForumThreadsPage {
  threads: ForumThread[];
  total: number;
  page: number;
  pages: number;
}

export interface ForumPostsPage {
  posts: ForumPost[];
  total: number;
  page: number;
  pages: number;
}
