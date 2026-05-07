export type UserBookStatus =
  | 'pending'
  | 'fetching_metadata'
  | 'fetching_text'
  | 'processing'
  | 'ready'
  | 'failed';

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string | null;
  roles: string[];
  joinedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SignUpReaderResponse {
  id: string;
  email: string;
  displayName: string;
  joinedAt: string;
  isNewReader: boolean;
}

export interface LibraryEntry {
  id: string;
  gutenbergId: string;
  title: string;
  author: string;
  status: UserBookStatus;
  statusMessage: string | null;
  lastEditedAt: string | null;
  createdAt: string;
}

export interface Edition {
  id: string;
  gutenbergId: string;
  title: string;
  author: string;
  markdownContent: string;
  status: UserBookStatus;
  statusMessage: string | null;
  lastEditedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SetEditionResponse {
  id: string;
  lastEditedAt: string;
}

export interface WithdrawEditionResponse {
  deleted: boolean;
}
