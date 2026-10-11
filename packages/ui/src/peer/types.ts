/**
 * Collaboration presence consumed by field controls.
 */
export interface CollaboratorPresence {
  clientId: string;
  displayName: string;
  /**
   * CSS color for this collaborator.
   */
  color: string;
  /**
   * Field path currently edited by this collaborator.
   */
  editing?: string;
}

export interface PresencePeer extends CollaboratorPresence {
  self?: boolean;
  /**
   * Picks the default avatar. Defaults to `clientId`.
   */
  peerId?: string;
  /**
   * Image URL of an uploaded avatar.
   */
  avatar?: string;
  /**
   * Short label shown after the name, such as "via link".
   */
  badge?: string;
}
