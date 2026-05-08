/**
 * API Types for Tunnel Operations
 */

// Tunnel types
export type TunnelType = 'sit' | 'gre' | 'wg';

// Request types
export interface CreateTunnelRequest {
  type: TunnelType;
  user_id: string;
  client_ipv4?: string;
}

export interface UpdateTunnelIpRequest {
  client_ipv4: string;
}

// Base tunnel interface
export interface Tunnel {
  id: string;
  type: TunnelType;
  user_id: string;
  status: 'active' | 'suspended';
  client_ipv4?: string;
  server_ipv4: string;
  endpoint_local: string;
  endpoint_remote: string;
  delegated_prefix_1: string;
  delegated_prefix_2: string;
  delegated_prefix_3?: string;
  created_at: string;
  updated_at?: string;
  // WireGuard-specific fields (only present for type='wg')
  server_public_key?: string;
  client_private_key?: string;
  client_public_key?: string;
  listen_port?: number;
}

// Type guard to check if a tunnel is WireGuard
export const isWireGuardTunnel = (tunnel: Tunnel): tunnel is WireGuardTunnel => {
  return tunnel.type === 'wg';
};

// Type-safe WireGuard tunnel interface
export interface WireGuardTunnel extends Tunnel {
  type: 'wg';
  server_public_key: string;  // Server's public key (from global wg0 config)
  client_private_key: string;
  client_public_key: string;
  listen_port: number;
  // Note: server_private_key is NOT included - it's global and not exposed to users
}

// Response types
export interface TunnelResponse {
  tunnel: Tunnel;
  commands: {
    server: string[];
    client: string[];
  };
}

export interface ErrorResponse {
  error: string;
  message?: string;
}

// DDNS types
export interface DyndnsTokenInfo {
  token_prefix: string;
  created_at: string;
  last_update_ip: string | null;
  last_update_at: string | null;
}

export interface CreateDyndnsTokenResponse {
  token: string;          // plaintext, shown to user once
  token_prefix: string;
  created_at: string;
}

export type DyndnsResponseCode =
  | "good"
  | "nochg"
  | "badauth"
  | "nohost"
  | "notfqdn"
  | "abuse"
  | "911";
