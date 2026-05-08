"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { CopyIcon, CheckIcon, DownloadIcon } from "lucide-react";
import { TunnelResponse, isWireGuardTunnel } from "@/types/api";
import { KeyField } from "@/components/key-field";
import { buildWireGuardClientConfig } from "@/utils/wireguard";

interface TunnelConfigDialogProps {
  tunnelId: string;
  tunnelData?: TunnelResponse;
  hideButton?: boolean;
}

export function TunnelConfigDialog({ tunnelId, tunnelData, hideButton = false }: TunnelConfigDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"server" | "client" | null>(null);

  // Domyślne komendy, używane tylko gdy nie ma danych z API
  const defaultServerCommands = [
    `ip tunnel add ${tunnelId} mode sit local SERVER_IPV4 remote CLIENT_IPV4 ttl 255`,
    `ip link set ${tunnelId} up`,
    `ip -6 addr add LOCAL_ENDPOINT dev ${tunnelId}`,
    `ip -6 route add PREFIX_1 dev ${tunnelId}`,
    `ip -6 route add PREFIX_2 dev ${tunnelId}`,
    `ip -6 route add PREFIX_3 dev ${tunnelId}`
  ];

  const defaultClientCommands = [
    `ip tunnel add ${tunnelId} mode sit local CLIENT_IPV4 remote SERVER_IPV4 ttl 255`,
    `ip link set ${tunnelId} up`,
    `ip -6 addr add REMOTE_ENDPOINT dev ${tunnelId}`,
    `ip -6 addr add PREFIX_1::1/64 dev ${tunnelId}`,
    `ip -6 addr add PREFIX_2::1/64 dev ${tunnelId}`,
    `ip -6 route add ::/0 via LOCAL_ENDPOINT_IP dev ${tunnelId}`,
    `ip -6 addr add PREFIX_3::1/64 dev ${tunnelId}`
  ];

  const copyToClipboard = async (text: string, type: "server" | "client") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Dialog.Root onOpenChange={setIsOpen}>
      {!hideButton && (
        <Dialog.Trigger asChild>
          <Button variant="outline" size="sm">
            View Configuration
          </Button>
        </Dialog.Trigger>
      )}
      {hideButton && (
        <Dialog.Trigger className="hidden" id={`dialog-trigger-${tunnelId}`}>
          <button>Open</button>
        </Dialog.Trigger>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 max-h-[85vh] w-[90vw] max-w-2xl translate-x-[-50%] translate-y-[-50%] overflow-auto rounded-md bg-background dark:bg-gray-900 p-6 shadow-lg border border-gray-200 dark:border-gray-800">
          <div className="mb-4">
            <Dialog.Title className="text-lg font-semibold dark:text-white">Tunnel Configuration: {tunnelId}</Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground dark:text-gray-300">
              Commands to set up your tunnel on both server and client sides.
            </Dialog.Description>
          </div>

          {error && (
            <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-md border border-red-200 dark:border-red-800">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <Tabs.Root defaultValue={tunnelData?.tunnel && isWireGuardTunnel(tunnelData.tunnel) ? "wireguard" : "client"}>
            <Tabs.List className="flex border-b mb-4 border-gray-200 dark:border-gray-700">
              {tunnelData?.tunnel && isWireGuardTunnel(tunnelData.tunnel) && (
                <Tabs.Trigger
                  value="wireguard"
                  className="px-4 py-2 flex-1 text-center border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:font-medium text-purple-600 dark:text-purple-400 dark:data-[state=active]:text-purple-300"
                >
                  WireGuard
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

            {tunnelData?.tunnel && isWireGuardTunnel(tunnelData.tunnel) && (
              <Tabs.Content value="wireguard" className="space-y-4">
                <div className="p-4 rounded-md bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-purple-900 dark:text-purple-200">WireGuard Configuration</h4>
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
                      Download
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
                        <KeyField label="Server Public Key" value={tunnelData.tunnel.server_public_key} />
                      </div>
                    </div>

                    <div className="p-3 rounded-md bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700">
                      <h5 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Client Keys</h5>
                      <div className="space-y-3">
                        <KeyField label="Client Public Key" value={tunnelData.tunnel.client_public_key} />
                        <KeyField label="Client Private Key" value={tunnelData.tunnel.client_private_key} sensitive warning="Provide securely" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                  <h4 className="font-semibold mb-2 dark:text-white">WireGuard Setup:</h4>
                  <ol className="list-decimal pl-5 space-y-1 text-sm dark:text-gray-300">
                    <li>Download the config file</li>
                    <li>Save to <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">/etc/wireguard/{tunnelId}.conf</code></li>
                    <li>Run: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">sudo wg-quick up {tunnelId}</code></li>
                    <li>The transfer address on your side is configured as a host route, while your three delegated `/64` prefixes stay fully routed through the tunnel.</li>
                    <li>Your public endpoint can change later. WireGuard will refresh it automatically after the next handshake.</li>
                  </ol>
                </div>
              </Tabs.Content>
            )}

            <Tabs.Content value="client" className="space-y-4">
              <div className="relative">
                <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto text-xs font-mono text-black dark:text-gray-200">
                  {tunnelData?.commands?.client ? tunnelData.commands.client.join('\n') : defaultClientCommands.join('\n')}
                </pre>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(tunnelData?.commands?.client ? tunnelData.commands.client.join('\n') : defaultClientCommands.join('\n'), "client")}
                >
                  {copied === "client" ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                </Button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold mb-2 dark:text-white">Client Setup Instructions:</h4>
                <ol className="list-decimal pl-5 space-y-1 text-sm dark:text-gray-300">
                  {tunnelData?.tunnel && isWireGuardTunnel(tunnelData.tunnel) ? (
                    <>
                      <li>Alternative manual commands for WireGuard.</li>
                      <li>Use the "WireGuard" tab instead.</li>
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
                  {tunnelData?.commands?.server ? tunnelData.commands.server.join('\n') : defaultServerCommands.join('\n')}
                </pre>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(tunnelData?.commands?.server ? tunnelData.commands.server.join('\n') : defaultServerCommands.join('\n'), "server")}
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

          <Dialog.Close className="absolute top-4 right-4 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
            </svg>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
