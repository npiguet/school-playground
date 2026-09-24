// The hotspot editor flag (scenes UI spec §4, plan Ruling 9): `?edit` before the hash
// (`/?edit#/p/1/camp`) or in the hash query (`#/p/1/camp?edit`).
export function isEditMode(search: string, query: Record<string, string>): boolean {
  return new URLSearchParams(search).has('edit') || Object.prototype.hasOwnProperty.call(query, 'edit');
}
