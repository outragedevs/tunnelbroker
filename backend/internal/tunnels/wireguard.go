package tunnels

import (
	"fmt"
	"strings"
)

func isWireGuardTunnelType(tunnelType string) bool {
	return strings.EqualFold(tunnelType, "wg")
}

func wireGuardHostCIDR(address string) string {
	host := strings.TrimSpace(strings.Split(address, "/")[0])
	if host == "" {
		return ""
	}

	return host + "/128"
}

func wireGuardAllowedIPs(endpointRemote, delegatedPrefix1, delegatedPrefix2, delegatedPrefix3 string) string {
	var allowed []string

	if hostCIDR := wireGuardHostCIDR(endpointRemote); hostCIDR != "" {
		allowed = append(allowed, hostCIDR)
	}

	for _, prefix := range []string{delegatedPrefix1, delegatedPrefix2, delegatedPrefix3} {
		if strings.TrimSpace(prefix) != "" {
			allowed = append(allowed, prefix)
		}
	}

	return strings.Join(allowed, ",")
}

func wireGuardClientInterfaceAddress(endpointRemote string) string {
	if hostCIDR := wireGuardHostCIDR(endpointRemote); hostCIDR != "" {
		return hostCIDR
	}

	return strings.TrimSpace(endpointRemote)
}

func wireGuardServerInterfaceAddress(endpointLocal string) string {
	if hostCIDR := wireGuardHostCIDR(endpointLocal); hostCIDR != "" {
		return hostCIDR
	}

	return strings.TrimSpace(endpointLocal)
}

func wireGuardRouteTargets(endpointRemote, delegatedPrefix1, delegatedPrefix2, delegatedPrefix3 string) []string {
	var routes []string

	if hostCIDR := wireGuardHostCIDR(endpointRemote); hostCIDR != "" {
		routes = append(routes, hostCIDR)
	}

	for _, prefix := range []string{delegatedPrefix1, delegatedPrefix2, delegatedPrefix3} {
		if strings.TrimSpace(prefix) != "" {
			routes = append(routes, prefix)
		}
	}

	return routes
}

func wireGuardServerCommands(wgInterface, clientPublicKey, endpointLocal, endpointRemote, delegatedPrefix1, delegatedPrefix2, delegatedPrefix3 string) []string {
	var commands []string

	if address := wireGuardServerInterfaceAddress(endpointLocal); address != "" {
		commands = append(commands, fmt.Sprintf("ip -6 addr add %s dev %s", address, wgInterface))
	}

	if allowedIPs := wireGuardAllowedIPs(endpointRemote, delegatedPrefix1, delegatedPrefix2, delegatedPrefix3); allowedIPs != "" && strings.TrimSpace(clientPublicKey) != "" {
		commands = append(commands, fmt.Sprintf("wg set %s peer %s allowed-ips %s", wgInterface, clientPublicKey, allowedIPs))
	}

	for _, route := range wireGuardRouteTargets(endpointRemote, delegatedPrefix1, delegatedPrefix2, delegatedPrefix3) {
		commands = append(commands, fmt.Sprintf("ip -6 route add %s dev %s", route, wgInterface))
	}

	return commands
}

func wireGuardClientCommands(clientInterface, endpointRemote, delegatedPrefix1, delegatedPrefix2, delegatedPrefix3, clientPrivateKey, serverPublicKey, serverIPv4 string, wgPort int) []string {
	commands := []string{
		fmt.Sprintf("ip link add dev %s type wireguard", clientInterface),
		fmt.Sprintf("ip -6 addr add %s dev %s", wireGuardClientInterfaceAddress(endpointRemote), clientInterface),
	}

	for _, prefix := range []string{delegatedPrefix1, delegatedPrefix2, delegatedPrefix3} {
		if strings.TrimSpace(prefix) == "" {
			continue
		}

		commands = append(commands, fmt.Sprintf("ip -6 addr add %s1/64 dev %s", strings.TrimSuffix(prefix, "/64"), clientInterface))
	}

	commands = append(commands,
		fmt.Sprintf("echo '%s' > /etc/wireguard/%s_private.key && chmod 600 /etc/wireguard/%s_private.key", clientPrivateKey, clientInterface, clientInterface),
		fmt.Sprintf("wg set %s private-key /etc/wireguard/%s_private.key peer %s endpoint %s:%d allowed-ips ::/0",
			clientInterface, clientInterface, serverPublicKey, serverIPv4, wgPort),
		fmt.Sprintf("ip link set %s up", clientInterface),
		fmt.Sprintf("ip -6 route add ::/0 dev %s", clientInterface),
	)

	return commands
}
