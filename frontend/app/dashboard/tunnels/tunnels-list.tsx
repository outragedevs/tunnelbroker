'use client';

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { TunnelConfigDialog } from "@/components/tunnel-config-dialog";
import { DyndnsPanel } from "@/components/dyndns-panel";
import { getTunnelDetails } from "@/utils/api-client";
import { TunnelResponse } from "@/types/api";

interface TunnelsListProps {
  tunnels: any[];
  error: string | null;
  activeTunnels: number;
  maxTunnels: number;
}

export function TunnelsList({ tunnels, error, activeTunnels, maxTunnels }: TunnelsListProps) {
  // Check if user has reached the active tunnel limit
  const hasReachedLimit = activeTunnels >= maxTunnels;

  // Stan do przechowywania pełnych danych tuneli
  const [tunnelsData, setTunnelsData] = useState<Record<string, TunnelResponse>>({});

  // Funkcja do pobierania pełnych danych tunelu
  const fetchTunnelDetails = async (tunnelId: string) => {
    try {
      const data = await getTunnelDetails(tunnelId);
      setTunnelsData(prev => ({
        ...prev,
        [tunnelId]: data
      }));
      return data;
    } catch (err) {
      console.error(`Error fetching details for tunnel ${tunnelId}:`, err);
      return null;
    }
  };

  return (
    <>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tunnel Management</h1>
        <Button
          asChild
          disabled={hasReachedLimit}
        >
          <Link href="/dashboard/tunnels/create">Create New Tunnel</Link>
        </Button>
      </div>

      {error && (
        <Card className="bg-destructive/10">
          <CardContent className="pt-6">
            <p>Error loading tunnels: {error}</p>
          </CardContent>
        </Card>
      )}

      {tunnels.length === 0 && !error && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center py-8 text-muted-foreground">
              You don't have any tunnels yet. Create your first tunnel to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {tunnels.length > 0 && (
        <div className="space-y-4">
          {tunnels.map((tunnel: any) => (
            <Card key={tunnel.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{tunnel.id}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      {tunnel.type === 'wg' ? (
                        <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700">
                          WireGuard
                        </Badge>
                      ) : (
                        <span>{tunnel.type ? tunnel.type.toUpperCase() : 'UNKNOWN'} Tunnel</span>
                      )}
                    </CardDescription>
                  </div>
                  <Badge>{tunnel.status}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Server IPv4:</span>
                      <span className="font-mono">{tunnel.server_ipv4}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Client IPv4:</span>
                      <span className="font-mono">
                        {tunnel.type === 'wg' ? (tunnel.client_ipv4 || 'Automatic via handshake') : tunnel.client_ipv4}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Local Endpoint:</span>
                      <span className="font-mono">{tunnel.endpoint_local}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Remote Endpoint:</span>
                      <span className="font-mono">{tunnel.endpoint_remote}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prefix 1:</span>
                      <span className="font-mono">{tunnel.delegated_prefix_1}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prefix 2:</span>
                      <span className="font-mono">{tunnel.delegated_prefix_2}</span>
                    </div>
                    {tunnel.delegated_prefix_3 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Prefix 3:</span>
                        <span className="font-mono">{tunnel.delegated_prefix_3}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created:</span>
                      <span>{new Date(tunnel.created_at).toLocaleDateString()}</span>
                    </div>
                    {tunnel.type === 'wg' && tunnel.listen_port && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">WG Port:</span>
                        <span className="font-mono text-purple-600 dark:text-purple-400">{tunnel.listen_port}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      // Jeśli nie mamy jeszcze danych tego tunelu, pobierz je
                      if (!tunnelsData[tunnel.id]) {
                        await fetchTunnelDetails(tunnel.id);
                      }
                      // Otwórz dialog z pełnymi danymi
                      const dialogTrigger = document.getElementById(`dialog-trigger-${tunnel.id}`);
                      if (dialogTrigger) {
                        (dialogTrigger as HTMLButtonElement).click();
                      }
                    }}
                  >
                    View Configuration
                  </Button>
                  <span id={`tunnel-config-dialog-${tunnel.id}`}>
                    <TunnelConfigDialog tunnelId={tunnel.id} tunnelData={tunnelsData[tunnel.id]} hideButton={true} />
                  </span>
                  {tunnel.type !== 'wg' ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/tunnels/${tunnel.id}/update-ip`}>Update Client IP</Link>
                    </Button>
                  ) : (
                    <Badge variant="outline" className="text-purple-700 border-purple-300 dark:text-purple-300 dark:border-purple-700">
                      Endpoint updates automatically
                    </Badge>
                  )}
                  <Button variant="destructive" size="sm" asChild>
                    <Link href={`/dashboard/tunnels/${tunnel.id}/delete`}>Delete Tunnel</Link>
                  </Button>
                </div>
                {tunnel.type !== 'wg' && (
                  <div className="mt-4">
                    <DyndnsPanel tunnelId={tunnel.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tunnel Limits</CardTitle>
          <CardDescription>Important information about your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p>
              Each user can have a <strong>maximum of {maxTunnels} active tunnels</strong> at any time.
              {hasReachedLimit && (
                <span className="text-destructive font-semibold"> You have reached your tunnel limit.</span>
              )}
              <span className="block mt-2 text-sm">
                You have {activeTunnels} out of {maxTunnels} active tunnels.
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Tip:</strong> You can delete existing tunnels and create new ones as needed.
              If your IP address changes, you can also update your tunnel configuration instead.
            </p>
            <p className="text-sm text-muted-foreground">
              This limitation helps prevent abuse and ensures fair resource distribution across our free service.
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
