/** User configuration */
export interface UserConfig {
  group: string;
  color: string;
  side?: string;
  passphrase?: string;
  isAdmin?: boolean;
}

/** User config response from the API */
export interface UserConfigResponse {
  version: string;
  lastUpdated: string;
  users: Record<string, UserConfig>;
}

/** A user's membership status within a group */
export interface MemberStatus {
  userId: string;
  activated: boolean;
}
