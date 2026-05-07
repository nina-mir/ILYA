export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  roles: string[];
  joinedAt: Date | null;
}
