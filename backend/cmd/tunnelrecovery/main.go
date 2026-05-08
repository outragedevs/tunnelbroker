package main

import (
	"bytes"
	"fmt"
	"log"
	"log/syslog"
	"os/exec"
	"strings"
	"time"

	"github.com/kofany/tunnelbroker/internal/config"
	"github.com/kofany/tunnelbroker/internal/db"
	tunnelspkg "github.com/kofany/tunnelbroker/internal/tunnels"
)

// Logger for syslog
var logger *log.Logger

func init() {
	var err error
	logger, err = syslog.NewLogger(syslog.LOG_NOTICE|syslog.LOG_DAEMON, log.LstdFlags)
	if err != nil {
		log.Fatalf("Failed to initialize syslog: %v", err)
	}
}

func main() {
	logger.Println("TunnelRecovery: Starting tunnel recovery process")

	// Load configuration
	if err := config.LoadConfig("/etc/tunnelbroker/config.yaml"); err != nil {
		logger.Fatalf("Failed to load configuration: %v", err)
	}

	if config.GlobalConfig.WireGuard.Interface != "" {
		if err := config.InitWireGuardInterface(); err != nil {
			logger.Printf("Warning: failed to initialize WireGuard interface before recovery: %v", err)
		}
	}

	if err := db.InitDB(); err != nil {
		logger.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.CloseDB()

	// Wait briefly for the rest of the system to settle after boot.
	time.Sleep(2 * time.Second)

	tunnels, err := tunnelspkg.GetAllTunnels()
	if err != nil {
		logger.Fatalf("Failed to load tunnels from database: %v", err)
	}

	logger.Printf("TunnelRecovery: Found %d tunnels in database", len(tunnels))

	// Get existing SIT/GRE tunnels in system
	existingTunnels, err := getExistingTunnels()
	if err != nil {
		logger.Fatalf("Failed to get existing tunnels: %v", err)
	}
	logger.Printf("TunnelRecovery: Found %d SIT/GRE tunnels in system", len(existingTunnels))

	// Get existing WireGuard peers
	existingWGPeers, err := getExistingWireGuardPeers()
	if err != nil {
		logger.Printf("Warning: Failed to get WireGuard peers: %v", err)
	}
	logger.Printf("TunnelRecovery: Found %d WireGuard peers in system", len(existingWGPeers))

	// Recreate missing tunnels
	recreatedCount := 0
	for _, tunnel := range tunnels {
		if tunnel.Status != "active" {
			logger.Printf("TunnelRecovery: Skipping inactive tunnel %s", tunnel.ID)
			continue
		}

		needsRecreation := false
		if strings.ToLower(tunnel.Type) == "wg" {
			// Reconcile all active WireGuard peers to restore addresses/routes too.
			needsRecreation = true
			if contains(existingWGPeers, tunnel.ClientPublicKey) {
				logger.Printf("TunnelRecovery: WireGuard peer %s already exists, reconciling server routes/address", tunnel.ID)
			}
		} else {
			// For SIT/GRE, check if interface exists by tunnel ID
			if !contains(existingTunnels, tunnel.ID) {
				needsRecreation = true
			}
		}

		if needsRecreation {
			logger.Printf("TunnelRecovery: Recreating missing tunnel %s (type: %s)", tunnel.ID, tunnel.Type)
			if err := recreateTunnel(&tunnel); err != nil {
				logger.Printf("TunnelRecovery: Failed to recreate tunnel %s: %v", tunnel.ID, err)
			} else {
				recreatedCount++
			}
		}
	}

	// Apply security rules ONCE at the end (not per-tunnel)
	if recreatedCount > 0 {
		logger.Println("TunnelRecovery: Applying security rules...")
		securityCmd := exec.Command("/etc/tunnelbroker/scripts/tunnel_security.sh")
		if err := securityCmd.Run(); err != nil {
			logger.Printf("TunnelRecovery: Warning: Failed to apply security rules: %v", err)
		}
	}

	logger.Printf("TunnelRecovery: Recovery completed. Recreated %d tunnels", recreatedCount)
}

// getExistingTunnels gets a list of existing tunnels in the system
func getExistingTunnels() ([]string, error) {
	var tunnels []string

	// Get SIT and GRE tunnels
	cmd := exec.Command("ip", "tunnel", "show")
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		logger.Printf("Warning: error running 'ip tunnel show': %v", err)
	} else {
		lines := strings.Split(out.String(), "\n")
		for _, line := range lines {
			if line == "" {
				continue
			}
			parts := strings.Split(line, ":")
			if len(parts) > 0 {
				tunnelName := strings.TrimSpace(parts[0])
				if tunnelName != "sit0" { // Skip the default sit0 interface
					tunnels = append(tunnels, tunnelName)
				}
			}
		}
	}

	// Note: WireGuard tunnels are handled separately via getExistingWireGuardPeers()
	// because they use a shared wg0 interface with multiple peers

	return tunnels, nil
}

// getExistingWireGuardPeers gets a list of existing WireGuard peer public keys
func getExistingWireGuardPeers() ([]string, error) {
	var peers []string

	wgInterface := config.GlobalConfig.WireGuard.Interface
	if wgInterface == "" {
		wgInterface = "wg0"
	}

	// Get peers from wg0 using 'wg show wg0 peers'
	cmd := exec.Command("wg", "show", wgInterface, "peers")
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		// wg0 might not exist yet
		logger.Printf("Info: No WireGuard peers found or wg0 not available: %v", err)
		return peers, nil
	}

	lines := strings.Split(out.String(), "\n")
	for _, line := range lines {
		peer := strings.TrimSpace(line)
		if peer != "" {
			peers = append(peers, peer)
		}
	}

	return peers, nil
}

// recreateTunnel recreates a tunnel in the system
func recreateTunnel(tunnel *tunnelspkg.Tunnel) error {
	commands := tunnelspkg.GenerateTunnelCommands(tunnel)
	for _, cmd := range commands.Server {
		parts := strings.Split(cmd, " ")
		command := exec.Command(parts[0], parts[1:]...)
		if output, err := command.CombinedOutput(); err != nil {
			// Reconciliation is idempotent, so pre-existing state is fine.
			if strings.Contains(string(output), "File exists") || strings.Contains(string(output), "already exists") {
				logger.Printf("TunnelRecovery: State already present, skipping: %s", cmd)
				continue
			}
			return fmt.Errorf("error executing command '%s': %w (output: %s)", cmd, err, string(output))
		}
	}

	return nil
}

// contains checks if a string is in a slice
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
