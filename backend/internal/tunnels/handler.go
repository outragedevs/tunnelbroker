package tunnels

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os/exec"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/kofany/tunnelbroker/internal/config"
	applog "github.com/kofany/tunnelbroker/internal/logger"
)

// executeCommands wykonuje listę komend systemowych
func executeCommands(commands []string) error {
	for _, cmd := range commands {
		args := strings.Fields(strings.TrimSpace(cmd))
		if len(args) == 0 {
			return fmt.Errorf("empty command")
		}

		command := exec.Command(args[0], args[1:]...)
		if err := command.Run(); err != nil {
			applog.Logger.Printf("Error executing command %s: %v", cmd, err)
			return err
		}
	}
	return nil
}

func isValidIPv4(ip string) bool {
	parsedIP := net.ParseIP(strings.TrimSpace(ip))
	return parsedIP != nil && parsedIP.To4() != nil
}

func requireUserIDMatch(c *gin.Context, tunnel *Tunnel) bool {
	userID := strings.TrimSpace(c.Query("user_id"))
	if !isValidHex4ID(userID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id query parameter must be a 4-character hexadecimal identifier"})
		return false
	}

	if tunnel.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this tunnel"})
		return false
	}

	return true
}

func cleanupTunnelSystemState(tunnel *Tunnel) {
	tunnelType := strings.ToLower(tunnel.Type)
	if isWireGuardTunnelType(tunnelType) {
		wgInterface := config.GlobalConfig.WireGuard.Interface

		for _, route := range wireGuardRouteTargets(tunnel.EndpointRemote, tunnel.DelegatedPrefix1, tunnel.DelegatedPrefix2, tunnel.DelegatedPrefix3) {
			if route == "" || wgInterface == "" {
				continue
			}

			routeCmd := exec.Command("ip", "-6", "route", "del", route, "dev", wgInterface)
			if err := routeCmd.Run(); err != nil {
				applog.Logger.Printf("Warning: failed to remove route %s: %v", route, err)
			}
		}

		if wgInterface != "" {
			if address := wireGuardServerInterfaceAddress(tunnel.EndpointLocal); address != "" {
				addressCmd := exec.Command("ip", "-6", "addr", "del", address, "dev", wgInterface)
				if err := addressCmd.Run(); err != nil {
					applog.Logger.Printf("Warning: failed to remove WireGuard address %s: %v", address, err)
				}
			}
		}

		if wgInterface != "" && tunnel.ClientPublicKey != "" {
			peerCmd := exec.Command("wg", "set", wgInterface, "peer", tunnel.ClientPublicKey, "remove")
			if err := peerCmd.Run(); err != nil {
				applog.Logger.Printf("Warning: failed to remove WireGuard peer %s: %v", tunnel.ClientPublicKey, err)
			}
		}

		return
	}

	command := exec.Command("ip", "tunnel", "del", tunnel.ID)
	if err := command.Run(); err != nil {
		applog.Logger.Printf("Warning: failed to remove tunnel interface %s: %v", tunnel.ID, err)
	}
}

// generateTunnelCommands generates commands for a given tunnel based on its type
func generateTunnelCommands(t *Tunnel) *TunnelCommands {
	commands := &TunnelCommands{}

	switch strings.ToLower(t.Type) {
	case "sit":
		commands.Server = []string{
			fmt.Sprintf("ip tunnel add %s mode sit local %s remote %s ttl 255", t.ID, t.ServerIPv4, t.ClientIPv4),
			fmt.Sprintf("ip link set %s up", t.ID),
			fmt.Sprintf("ip -6 addr add %s dev %s", t.EndpointLocal, t.ID),
			fmt.Sprintf("ip -6 route add %s dev %s", t.DelegatedPrefix1, t.ID),
			fmt.Sprintf("ip -6 route add %s dev %s", t.DelegatedPrefix2, t.ID),
		}
		if t.DelegatedPrefix3 != "" {
			commands.Server = append(commands.Server, fmt.Sprintf("ip -6 route add %s dev %s", t.DelegatedPrefix3, t.ID))
		}
		commands.Client = []string{
			fmt.Sprintf("ip tunnel add %s mode sit local %s remote %s ttl 255", t.ID, t.ClientIPv4, t.ServerIPv4),
			fmt.Sprintf("ip link set %s up", t.ID),
			fmt.Sprintf("ip -6 addr add %s dev %s", t.EndpointRemote, t.ID),
			fmt.Sprintf("ip -6 addr add %s1/64 dev %s", strings.TrimSuffix(t.DelegatedPrefix1, "/64"), t.ID),
			fmt.Sprintf("ip -6 addr add %s1/64 dev %s", strings.TrimSuffix(t.DelegatedPrefix2, "/64"), t.ID),
			fmt.Sprintf("ip -6 route add ::/0 via %s dev %s", strings.TrimSuffix(t.EndpointLocal, "/64"), t.ID),
		}
		if t.DelegatedPrefix3 != "" {
			commands.Client = append(commands.Client, fmt.Sprintf("ip -6 addr add %s1/64 dev %s", strings.TrimSuffix(t.DelegatedPrefix3, "/64"), t.ID))
		}

	case "gre":
		commands.Server = []string{
			fmt.Sprintf("ip tunnel add %s mode gre local %s remote %s ttl 255", t.ID, t.ServerIPv4, t.ClientIPv4),
			fmt.Sprintf("ip link set %s up", t.ID),
			fmt.Sprintf("ip -6 addr add %s dev %s", t.EndpointLocal, t.ID),
			fmt.Sprintf("ip -6 route add %s dev %s", t.DelegatedPrefix1, t.ID),
			fmt.Sprintf("ip -6 route add %s dev %s", t.DelegatedPrefix2, t.ID),
		}
		if t.DelegatedPrefix3 != "" {
			commands.Server = append(commands.Server, fmt.Sprintf("ip -6 route add %s dev %s", t.DelegatedPrefix3, t.ID))
		}
		commands.Client = []string{
			fmt.Sprintf("ip tunnel add %s mode gre local %s remote %s ttl 255", t.ID, t.ClientIPv4, t.ServerIPv4),
			fmt.Sprintf("ip link set %s up", t.ID),
			fmt.Sprintf("ip -6 addr add %s dev %s", t.EndpointRemote, t.ID),
			fmt.Sprintf("ip -6 addr add %s1/64 dev %s", strings.TrimSuffix(t.DelegatedPrefix1, "/64"), t.ID),
			fmt.Sprintf("ip -6 addr add %s1/64 dev %s", strings.TrimSuffix(t.DelegatedPrefix2, "/64"), t.ID),
			fmt.Sprintf("ip -6 route add ::/0 via %s dev %s", strings.TrimSuffix(t.EndpointLocal, "/64"), t.ID),
		}
		if t.DelegatedPrefix3 != "" {
			commands.Client = append(commands.Client, fmt.Sprintf("ip -6 addr add %s1/64 dev %s", strings.TrimSuffix(t.DelegatedPrefix3, "/64"), t.ID))
		}

	case "wg":
		// WireGuard uses single wg0 interface with multiple peers
		wgInterface := config.GlobalConfig.WireGuard.Interface
		wgPort := config.GlobalConfig.WireGuard.ListenPort
		serverPubKey := config.GlobalConfig.WireGuard.PublicKey

		commands.Server = wireGuardServerCommands(
			wgInterface,
			t.ClientPublicKey,
			t.EndpointLocal,
			t.EndpointRemote,
			t.DelegatedPrefix1,
			t.DelegatedPrefix2,
			t.DelegatedPrefix3,
		)

		commands.Client = wireGuardClientCommands(
			t.ID,
			t.EndpointRemote,
			t.DelegatedPrefix1,
			t.DelegatedPrefix2,
			t.DelegatedPrefix3,
			t.ClientPrivateKey,
			serverPubKey,
			t.ServerIPv4,
			wgPort,
		)
	}

	return commands
}

func sanitizeListCommands(tunnelType string, commands *TunnelCommands) {
	if !isWireGuardTunnelType(tunnelType) {
		return
	}

	for i, cmd := range commands.Client {
		if strings.Contains(cmd, "/etc/wireguard/") && strings.Contains(cmd, "_private.key") && strings.Contains(cmd, "chmod 600") {
			commands.Client[i] = "echo '[hidden]' > /etc/wireguard/<interface>_private.key && chmod 600 /etc/wireguard/<interface>_private.key"
		}
	}
}

// CreateTunnelHandler handles POST /api/v1/tunnels request
func CreateTunnelHandler(c *gin.Context) {
	var req struct {
		Type       string `json:"type" binding:"required,oneof=sit gre wg"`
		UserID     string `json:"user_id" binding:"required,len=4"`
		ClientIPv4 string `json:"client_ipv4"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		applog.Logger.Printf("Request validation error: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !isValidHex4ID(req.UserID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id must be a 4-character hexadecimal identifier"})
		return
	}

	if !isWireGuardTunnelType(req.Type) && !isValidIPv4(req.ClientIPv4) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "client_ipv4 is required and must be a valid IPv4 address for SIT/GRE tunnels"})
		return
	}

	if isWireGuardTunnelType(req.Type) {
		req.ClientIPv4 = ""
	}

	// Get server_ipv4 from configuration
	serverIPv4 := config.GlobalConfig.Server.IPv4
	if serverIPv4 == "" {
		applog.Logger.Printf("Error: missing server_ipv4 configuration")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "missing server_ipv4 configuration"})
		return
	}

	createLock, err := AcquireTunnelCreateLock(context.Background())
	if err != nil {
		applog.Logger.Printf("Error acquiring create lock: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Tunnel allocation lock error"})
		return
	}
	defer func() {
		if releaseErr := createLock.Release(context.Background()); releaseErr != nil {
			applog.Logger.Printf("Warning: failed to release create lock: %v", releaseErr)
		}
	}()

	tunnel, commands, err := CreateTunnelService(req.Type, req.UserID, req.ClientIPv4, serverIPv4)
	if err != nil {
		applog.Logger.Printf("Error creating tunnel: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Execute server-side commands
	if err := executeCommands(commands.Server); err != nil {
		applog.Logger.Printf("Error executing server commands: %v", err)
		cleanupTunnelSystemState(tunnel)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Tunnel configuration error"})
		return
	}

	if err := CreateTunnelWithTransaction(tunnel); err != nil {
		applog.Logger.Printf("Error persisting tunnel after server setup: %v", err)
		cleanupTunnelSystemState(tunnel)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Tunnel persistence error"})
		return
	}

	// Apply security rules
	securityCmd := exec.Command("/etc/tunnelbroker/scripts/tunnel_security.sh")
	if err := securityCmd.Run(); err != nil {
		applog.Logger.Printf("Error applying security rules: %v", err)
		// Continue even if security script fails
	}

	c.JSON(http.StatusOK, gin.H{
		"tunnel":   tunnel,
		"commands": commands,
	})
}

// UpdateClientIPHandler handles PATCH /api/v1/tunnels/:tunnel_id/ip request
func UpdateClientIPHandler(c *gin.Context) {
	tunnelID := c.Param("tunnel_id")
	var req struct {
		UserID     string `json:"user_id" binding:"required,len=4"`
		ClientIPv4 string `json:"client_ipv4" binding:"required,ipv4"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if !isValidHex4ID(req.UserID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id must be a 4-character hexadecimal identifier"})
		return
	}

	tunnel, err := GetTunnelByID(tunnelID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if tunnel.UserID != req.UserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have access to this tunnel"})
		return
	}

	if isWireGuardTunnelType(tunnel.Type) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "WireGuard clients update their endpoint automatically after handshake; manual client IP updates are not required.",
		})
		return
	}

	// Generowanie komend zależnie od typu tunelu
	var commands TunnelCommands

	tunnelType := strings.ToLower(tunnel.Type)
	commands.Server = []string{
		fmt.Sprintf("ip tunnel change %s mode %s remote %s ttl 255",
			tunnel.ID, tunnelType, req.ClientIPv4),
	}
	commands.Client = []string{
		fmt.Sprintf("ip tunnel change %s mode %s remote %s local %s ttl 255",
			tunnel.ID, tunnelType, tunnel.ServerIPv4, req.ClientIPv4),
	}

	// Wykonanie komend systemowych
	if len(commands.Server) > 0 {
		if err := executeCommands(commands.Server); err != nil {
			applog.Logger.Printf("Error updating tunnel interface: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Tunnel update error"})
			return
		}
	}

	previousClientIPv4 := tunnel.ClientIPv4
	if err := UpdateClientIPv4(tunnelID, req.ClientIPv4); err != nil {
		revertCommands := []string{
			fmt.Sprintf("ip tunnel change %s mode %s remote %s ttl 255",
				tunnel.ID, tunnelType, previousClientIPv4),
		}
		if revertErr := executeCommands(revertCommands); revertErr != nil {
			applog.Logger.Printf("Warning: failed to revert tunnel interface after db error: %v", revertErr)
		}

		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	tunnel.ClientIPv4 = req.ClientIPv4

	// Zastosuj również reguły bezpieczeństwa po aktualizacji
	securityCmd := exec.Command("/etc/tunnelbroker/scripts/tunnel_security.sh")
	if err := securityCmd.Run(); err != nil {
		applog.Logger.Printf("Warning: Error applying security rules after IP update: %v", err)
		// Continue even if security script fails
	}

	c.JSON(http.StatusOK, gin.H{
		"tunnel":   tunnel,
		"commands": commands,
	})
}

// DeleteTunnelHandler handles DELETE /api/v1/tunnels/:tunnel_id request
func DeleteTunnelHandler(c *gin.Context) {
	tunnelID := c.Param("tunnel_id")

	// Get tunnel info before deletion to retrieve user_id
	tunnel, err := GetTunnelByID(tunnelID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tunnel not found"})
		} else {
			applog.Logger.Printf("Error retrieving tunnel info for deletion: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	if !requireUserIDMatch(c, tunnel) {
		return
	}

	// Remove tunnel from system
	cleanupTunnelSystemState(tunnel)

	// Then delete from database
	if err := DeleteTunnel(tunnelID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Update user's tunnel counters (both active and created)
	if err := DecrementUserTunnels(tunnel.UserID); err != nil {
		applog.Logger.Printf("Error updating user tunnels counter: %v", err)
		// Continue even if counter update fails
	}

	// Apply security script to refresh the rules and clean up any remaining rules
	securityCmd := exec.Command("/etc/tunnelbroker/scripts/tunnel_security.sh")
	if err := securityCmd.Run(); err != nil {
		applog.Logger.Printf("Error applying security rules after tunnel deletion: %v", err)
		// Continue even if security script fails
	}

	c.Status(http.StatusNoContent)
}

// GetTunnelsHandler handles GET /api/v1/tunnels request
func GetTunnelsHandler(c *gin.Context) {
	userID := c.Query("user_id")
	if !isValidHex4ID(userID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id query parameter must be a 4-character hexadecimal identifier"})
		return
	}

	tunnels, err := GetUserTunnels(userID)
	if err != nil {
		applog.Logger.Printf("Error retrieving tunnels: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Dla każdego tunelu wygeneruj komendy
	type TunnelWithCommands struct {
		Tunnel   Tunnel         `json:"tunnel"`
		Commands TunnelCommands `json:"commands"`
	}

	var response []TunnelWithCommands
	for _, t := range tunnels {
		tCopy := t // Create a copy to pass pointer
		commands := generateTunnelCommands(&tCopy)
		sanitizeListCommands(t.Type, commands)
		t.ClientPrivateKey = ""
		t.ServerPrivateKey = ""

		response = append(response, TunnelWithCommands{
			Tunnel:   t,
			Commands: *commands,
		})
	}

	c.JSON(http.StatusOK, response)
}

// GetUserTunnelsHandler handles GET /api/v1/tunnels/user/:user_id request
func GetUserTunnelsHandler(c *gin.Context) {
	userID := c.Param("user_id")

	if !isValidHex4ID(userID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user_id format. Must be 4 hexadecimal characters."})
		return
	}

	// Get tunnels for the specified user
	tunnels, err := GetUserTunnels(userID)
	if err != nil {
		applog.Logger.Printf("Error retrieving user tunnels: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Get user information
	user, err := GetUserByID(userID)
	if err != nil {
		applog.Logger.Printf("Error retrieving user info: %v", err)
		// Continue even if user info retrieval fails, just log the error
		user = &User{
			ID:             userID,
			CreatedTunnels: 0,
			ActiveTunnels:  0,
		}
	}

	// For each tunnel, generate commands
	type TunnelWithCommands struct {
		Tunnel   Tunnel         `json:"tunnel"`
		Commands TunnelCommands `json:"commands"`
	}

	var tunnelsWithCommands []TunnelWithCommands
	for _, t := range tunnels {
		tCopy := t // Create a copy to pass pointer
		commands := generateTunnelCommands(&tCopy)
		sanitizeListCommands(t.Type, commands)
		t.ClientPrivateKey = ""
		t.ServerPrivateKey = ""

		tunnelsWithCommands = append(tunnelsWithCommands, TunnelWithCommands{
			Tunnel:   t,
			Commands: *commands,
		})
	}

	// Create response with tunnels and user info
	response := gin.H{
		"tunnels": tunnelsWithCommands,
		"user_info": gin.H{
			"created_tunnels": user.CreatedTunnels,
			"active_tunnels":  user.ActiveTunnels,
		},
	}

	// If no tunnels found, return empty array for tunnels
	if len(tunnels) == 0 {
		response["tunnels"] = []any{}
	}

	c.JSON(http.StatusOK, response)
}

// GetTunnelHandler handles GET /api/v1/tunnels/:tunnel_id request
func GetTunnelHandler(c *gin.Context) {
	tunnelID := c.Param("tunnel_id")

	tunnel, err := GetTunnelByID(tunnelID)
	if err != nil {
		if strings.Contains(err.Error(), "tunnel not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		applog.Logger.Printf("Error retrieving tunnel: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if !requireUserIDMatch(c, tunnel) {
		return
	}

	// Generowanie komend dla tunelu
	commands := generateTunnelCommands(tunnel)

	c.JSON(http.StatusOK, gin.H{
		"tunnel":   tunnel,
		"commands": commands,
	})
}
