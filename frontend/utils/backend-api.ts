export function getTunnelbrokerApiUrl(): string {
  return process.env.TUNNELBROKER_API_URL || process.env.NEXT_PUBLIC_API_URL || "";
}

export function getTunnelbrokerApiKey(): string {
  return process.env.TUNNELBROKER_API_KEY || process.env.NEXT_PUBLIC_API_KEY || "";
}
