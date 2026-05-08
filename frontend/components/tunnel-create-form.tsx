"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { Checkbox } from "./ui/checkbox";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { CopyIcon, CheckIcon } from "lucide-react";
import { TunnelResponse, TunnelType, isWireGuardTunnel } from "@/types/api";
import { KeyField } from "@/components/key-field";
import { DownloadIcon } from "lucide-react";
import { buildWireGuardClientConfig } from "@/utils/wireguard";

interface TunnelCreateFormProps {
  userId: string;
  onSuccess?: () => void;
}

export function TunnelCreateForm({ userId, onSuccess }: TunnelCreateFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientIp, setClientIp] = useState("");
  const [tunnelType, setTunnelType] = useState<TunnelType>("sit");
  const [tunnelData, setTunnelData] = useState<TunnelResponse | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [copied, setCopied] = useState<"server" | "client" | null>(null);
  const router = useRouter();

  const copyToClipboard = async (text: string, type: "server" | "client") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setTunnelData(null);

    try {
      // Validate IP address for SIT/GRE only
      if (tunnelType !== "wg" && !isValidIpv4(clientIp)) {
        throw new Error("Please enter a valid IPv4 address");
      }

      // Create the tunnel
      try {
        const response = await fetch('/api/tunnels', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: tunnelType,
            user_id: userId,
            ...(tunnelType === "wg" ? {} : { client_ipv4: clientIp }),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `API error: ${response.status}`);
        }

        const data = await response.json();

        // Validate data structure
        if (!data || !data.tunnel || !data.commands) {
          console.error('Invalid data structure received:', data);
          throw new Error('Invalid response format from server');
        }

        // Store the tunnel data for displaying configuration
        setTunnelData(data);
        setIsConfigOpen(true);

        // Clear the form
        setClientIp('');
      } catch (apiError) {
        console.error('API error during tunnel creation:', apiError);
        throw apiError;
      }

      // Don't refresh or redirect yet - show the configuration first
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      setError(err instanceof Error ? err.message : "Failed to create tunnel");
    } finally {
      setIsLoading(false);
    }
  };

  // Simple IPv4 validation
  const isValidIpv4 = (ip: string) => {
    const regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    if (!regex.test(ip)) return false;

    const parts = ip.split('.').map(part => parseInt(part, 10));
    return parts.every(part => part >= 0 && part <= 255);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Create New Tunnel</CardTitle>
          <CardDescription>Set up a new IPv6 tunnel</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Tunnel Type</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sit"
                  checked={tunnelType === "sit"}
                  onCheckedChange={() => setTunnelType("sit")}
                />
                <Label htmlFor="sit" className="cursor-pointer">SIT (Simple Internet Transition)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="gre"
                  checked={tunnelType === "gre"}
                  onCheckedChange={() => setTunnelType("gre")}
                />
                <Label htmlFor="gre" className="cursor-pointer">GRE (Generic Routing Encapsulation)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="wg"
                  checked={tunnelType === "wg"}
                  onCheckedChange={() => setTunnelType("wg")}
                />
                <Label htmlFor="wg" className="cursor-pointer">
                  WireGuard <span className="text-purple-600 dark:text-purple-400 font-semibold ml-1">NEW</span>
                </Label>
              </div>
              {tunnelType === "wg" && (
                <div className="mt-2 p-3 rounded-md bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    WireGuard provides modern, secure VPN technology with automatic key generation.
                    The server learns your current endpoint automatically, so no client IPv4 is required here.
                    Your transfer address is configured as a single host address, while all three delegated `/64` prefixes remain routed over the tunnel.
                  </p>
                </div>
              )}
            </div>

            {tunnelType !== "wg" && (
              <div className="space-y-2">
                <Label htmlFor="clientIp">Client IPv4 Address</Label>
                <Input
                  id="clientIp"
                  placeholder="Enter your public IPv4 address"
                  value={clientIp}
                  onChange={(e) => setClientIp(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This is the public IPv4 address from which you will connect to the tunnel.
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">{error}</div>
            )}

            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Tunnel"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Tunnel Configuration Dialog */}
      <Dialog.Root open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-2xl translate-x-[-50%] translate-y-[-50%] overflow-auto rounded-md bg-background dark:bg-gray-900 p-6 shadow-lg border border-gray-200 dark:border-gray-800">
            <div className="mb-4">
              <Dialog.Title className="text-lg font-semibold dark:text-white">
                Tunnel Created Successfully!
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground dark:text-gray-300">
                Your tunnel has been created. Below are the commands to set it up on your client machine.
              </Dialog.Description>
            </div>

            {tunnelData && (
              <Tabs.Root defaultValue={isWireGuardTunnel(tunnelData.tunnel) ? "wireguard" : "client"}>
                <Tabs.List className="flex border-b mb-4 border-gray-200 dark:border-gray-700">
                  {isWireGuardTunnel(tunnelData.tunnel) && (
                    <Tabs.Trigger
                      value="wireguard"
                      className="px-4 py-2 flex-1 text-center border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:font-medium text-purple-600 dark:text-purple-400 dark:data-[state=active]:text-purple-300"
                    >
                      WireGuard Config
                    </Tabs.Trigger>
                  )}
                  <Tabs.Trigger
                    value="client"
                    className="px-4 py-2 flex-1 text-center border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:font-medium dark:text-gray-300 dark:data-[state=active]:text-white"
                  >
                    Client Configuration
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="server"
                    className="px-4 py-2 flex-1 text-center border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:font-medium dark:text-gray-300 dark:data-[state=active]:text-white"
                  >
                    Server Configuration
                  </Tabs.Trigger>
                </Tabs.List>

                {isWireGuardTunnel(tunnelData.tunnel) && (
                  <Tabs.Content value="wireguard" className="space-y-4">
                    <div className="p-4 rounded-md bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-purple-900 dark:text-purple-200">WireGuard Configuration File</h4>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-purple-300 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/30"
                          onClick={() => {
                            const tunnel = tunnelData.tunnel;
                            if (!isWireGuardTunnel(tunnel)) return;
                            const config = buildWireGuardClientConfig(tunnel);
                            const blob = new Blob([config], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${tunnel.id}.conf`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <DownloadIcon size={16} className="mr-1" />
                          Download Config
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <div className="p-3 rounded-md bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Listen Port</p>
                          <code className="text-sm font-mono text-gray-900 dark:text-gray-100">{tunnelData.tunnel.listen_port}</code>
                        </div>

                        <div className="p-3 rounded-md bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700">
                          <h5 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Server Key</h5>
                          <div className="space-y-3">
                            <KeyField label="Server Public Key" value={tunnelData.tunnel.server_public_key!} />
                          </div>
                        </div>

                        <div className="p-3 rounded-md bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700">
                          <h5 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Client Keys</h5>
                          <div className="space-y-3">
                            <KeyField label="Client Public Key" value={tunnelData.tunnel.client_public_key!} />
                            <KeyField label="Client Private Key" value={tunnelData.tunnel.client_private_key!} sensitive warning="Provide securely" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                      <h4 className="font-semibold mb-2 dark:text-white">WireGuard Setup Instructions:</h4>
                      <ol className="list-decimal pl-5 space-y-1 text-sm dark:text-gray-300">
                        <li>Download the WireGuard config file using the button above.</li>
                        <li>Save it to <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">/etc/wireguard/{tunnelData.tunnel.id}.conf</code></li>
                        <li>Run: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">sudo wg-quick up {tunnelData.tunnel.id}</code></li>
                        <li>To stop: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">sudo wg-quick down {tunnelData.tunnel.id}</code></li>
                        <li>The transfer endpoint uses a host route, and your three delegated `/64` prefixes are added as normal IPv6 addresses on the client.</li>
                        <li>Your public endpoint can change later. WireGuard will update it automatically after a new handshake.</li>
                      </ol>
                    </div>
                  </Tabs.Content>
                )}

                <Tabs.Content value="client" className="space-y-4">
                  <div className="relative">
                    <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto text-xs font-mono text-black dark:text-gray-200">
                      {tunnelData.commands.client.join('\n')}
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(tunnelData.commands.client.join('\n'), "client")}
                    >
                      {copied === "client" ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                    </Button>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold mb-2 dark:text-white">Client Setup Instructions:</h4>
                    <ol className="list-decimal pl-5 space-y-1 text-sm dark:text-gray-300">
                      {isWireGuardTunnel(tunnelData.tunnel) ? (
                        <>
                          <li>These are alternative manual commands for WireGuard setup.</li>
                          <li>We recommend using the "WireGuard Config" tab instead.</li>
                          <li>Make sure WireGuard is installed on your system.</li>
                        </>
                      ) : (
                        <>
                          <li>These commands should be run on your client machine (your computer or server).</li>
                          <li>You need root/administrator privileges to run these commands.</li>
                          <li>Make sure your firewall allows protocol 41 (IPv6 over IPv4) traffic.</li>
                          <li>After running these commands, you should have IPv6 connectivity.</li>
                        </>
                      )}
                    </ol>
                  </div>
                </Tabs.Content>

                <Tabs.Content value="server" className="space-y-4">
                  <div className="relative">
                    <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto text-xs font-mono text-black dark:text-gray-200">
                      {tunnelData.commands.server.join('\n')}
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(tunnelData.commands.server.join('\n'), "server")}
                    >
                      {copied === "server" ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                    </Button>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold mb-2 dark:text-white">Server Information:</h4>
                    <p className="text-sm dark:text-gray-300">
                      These commands are already running on our server. You don't need to execute them.
                      They are provided for informational purposes only.
                    </p>
                  </div>
                </Tabs.Content>
              </Tabs.Root>
            )}

            <div className="mt-6 flex justify-end space-x-4">
              <Button onClick={() => {
                setIsConfigOpen(false);
                if (onSuccess) {
                  onSuccess();
                } else {
                  router.refresh();
                }
              }}>
                Done
              </Button>
            </div>

            <Dialog.Close className="absolute top-4 right-4 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
              </svg>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
