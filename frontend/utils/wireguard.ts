import { WireGuardTunnel } from "@/types/api";

export function getWireGuardInterfaceAddress(endpoint: string | undefined): string | null {
  if (!endpoint) {
    return null;
  }

  const [host] = endpoint.split("/");
  if (!host) {
    return null;
  }

  return `${host}/128`;
}

export function getDelegatedPrefixClientAddress(prefix: string | undefined): string | null {
  if (!prefix) {
    return null;
  }

  return `${prefix.replace(/\/64$/, "")}1/64`;
}

export function buildWireGuardClientConfig(tunnel: WireGuardTunnel): string {
  const interfaceAddresses = [
    getWireGuardInterfaceAddress(tunnel.endpoint_remote),
    getDelegatedPrefixClientAddress(tunnel.delegated_prefix_1),
    getDelegatedPrefixClientAddress(tunnel.delegated_prefix_2),
    getDelegatedPrefixClientAddress(tunnel.delegated_prefix_3),
  ].filter((value): value is string => Boolean(value));

  const lines = [
    "[Interface]",
    `PrivateKey = ${tunnel.client_private_key}`,
    ...interfaceAddresses.map((address) => `Address = ${address}`),
    "",
    "[Peer]",
    `PublicKey = ${tunnel.server_public_key}`,
    `Endpoint = ${tunnel.server_ipv4}:${tunnel.listen_port}`,
    "AllowedIPs = ::/0",
    "PersistentKeepalive = 25",
    "",
  ];

  return lines.join("\n");
}
