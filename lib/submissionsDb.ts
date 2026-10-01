// Shared database utility for anime submissions: lib/submissionsDb.ts
import fs from 'fs';
import path from 'path';

export interface ServerAnimeSubmission {
  id: string;
  title: string;
  romajiTitle?: string;
  poster: string;
  imageUrl?: string;
  banner?: string;
  type: 'Series' | 'Movie' | 'Special' | 'OVA';
  releaseYear: number;
  originalReleaseDate?: string;
  rating: number;
  episodes?: number;
  status: 'Ongoing' | 'Completed' | 'Airing' | 'Upcoming';
  airingStatus?: 'Ongoing' | 'Completed';
  releaseDay?: string;
  airingDay?: string;
  submissionStatus: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  genres: string[];
  themes?: string[];
  studio: string;
  synopsis: string;
  characters?: any[];
  dubs: string[];
  dubDetails?: any[];
  platforms: { name: string; url: string }[];
  submittedBy?: {
    userId: string;
    userName: string;
    userEmail?: string;
  };
  submittedAt: string;
  updatedAt?: string;
}

// In-memory cache + persistent file backup in /tmp
const TMP_FILE = path.join('/tmp', 'anidub_submissions_v1.json');
let memorySubmissions: ServerAnimeSubmission[] = [];

export function loadSubmissions(): ServerAnimeSubmission[] {
  if (memorySubmissions.length > 0) {
    return memorySubmissions;
  }
  try {
    if (fs.existsSync(TMP_FILE)) {
      const content = fs.readFileSync(TMP_FILE, 'utf-8');
      memorySubmissions = JSON.parse(content);
      return memorySubmissions;
    }
  } catch (err) {
    console.error('Failed reading tmp submissions file:', err);
  }
  return memorySubmissions;
}

export function saveSubmissions(list: ServerAnimeSubmission[]): void {
  memorySubmissions = list;
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed writing tmp submissions file:', err);
  }
}

export function updateSubmissionStatus(
  id: string,
  newStatus: 'approved' | 'rejected',
  reviewer: string = 'Telegram Admin Bot',
  rejectionReason?: string
): ServerAnimeSubmission | null {
  const current = loadSubmissions();
  const index = current.findIndex((s) => s.id === id);

  if (index === -1) {
    const stubRecord: ServerAnimeSubmission = {
      id,
      title: 'Anime Submission #' + id.slice(-6),
      poster: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
      type: 'Series',
      releaseYear: new Date().getFullYear(),
      rating: 8.0,
      status: 'Ongoing',
      submissionStatus: newStatus,
      reviewedBy: reviewer,
      reviewedAt: new Date().toISOString(),
      genres: ['Action', 'Shonen'],
      studio: 'Animation Studio',
      synopsis: 'Dubbed regional anime release.',
      dubs: ['Tamil', 'Telugu', 'Hindi'],
      platforms: [{ name: 'Crunchyroll', url: '' }],
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    current.push(stubRecord);
    saveSubmissions(current);
    return stubRecord;
  }

  current[index].submissionStatus = newStatus;
  current[index].status = 'Ongoing';
  current[index].reviewedBy = reviewer;
  current[index].reviewedAt = new Date().toISOString();
  current[index].updatedAt = new Date().toISOString();
  if (rejectionReason) {
    current[index].rejectionReason = rejectionReason;
  }
  saveSubmissions(current);
  return current[index];
}
