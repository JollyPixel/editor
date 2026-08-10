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
