import { Photo } from './Photo';

export interface Report {
  id: string;
  name: string;
  createdAt: string; // ISO 8601 string
  updatedAt?: string; // ISO 8601 string
  photos: Photo[];
  description?: string;
}
