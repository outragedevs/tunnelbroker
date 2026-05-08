/**
 * Deprecated: tunnel counters are maintained by the backend create/delete flow.
 * Keep this helper as a safe no-op fallback so client code never tries to call
 * the backend directly with privileged credentials.
 */
export async function incrementCreatedTunnelsClient(hex4Id: string) {
  console.warn(`incrementCreatedTunnelsClient(${hex4Id}) is deprecated and intentionally disabled.`);
  return { success: false, error: 'Deprecated client helper. Tunnel counters are updated server-side.' };
}
