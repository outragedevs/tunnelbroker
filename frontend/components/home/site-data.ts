export const AS_NUMBER = 198889;
export const PEER_AS_NUMBER = 56655;
export const PEER_NAME = "Gigahost";
export const BGP_SESSIONS = 4;
export const ENDPOINT_LOCATION = "Oslo, NO";
export const RTT_OSLO_IX = "~3 ms";
export const SERVER_IPV4 = "185.243.218.164";
export const WG_PORT = 51820;

export const PREFIX_POOLS = [
  { cidr: "2a05:1083:bef0::/44", role: "primary delegation" },
  { cidr: "2a12:bec0:02c0::/44", role: "secondary delegation" },
  { cidr: "2a05:1083:bee0::/44", role: "primary (alt)" },
  { cidr: "2a05:dfc1:3c10::/44", role: "secondary (alt)" },
  { cidr: "2a03:94e0:2496::/48", role: "non-BGP local" },
] as const;

export const BLOCKED_PORTS_SMTP = [25, 465, 587, 2525];
export const BLOCKED_PORTS_POP_IMAP = [110, 143, 993, 995];

export const COMPATIBLE_DDNS_CLIENTS = [
  "Fritz!Box",
  "MikroTik",
  "OpenWrt",
  "ASUS Merlin",
  "OPNsense",
  "pfSense",
  "ddclient",
  "inadyn",
  "curl",
] as const;
