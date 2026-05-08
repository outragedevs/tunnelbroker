"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function UpdateTunnelIpPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [clientIp, setClientIp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isValidIpv4 = (ip: string) => {
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    if (!ipv4Regex.test(ip)) return false;

    const parts = ip.split('.').map(part => parseInt(part, 10));
    return parts.every(part => part >= 0 && part <= 255);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Validate IP address
      if (!isValidIpv4(clientIp)) {
        throw new Error("Please enter a valid IPv4 address");
      }

      const response = await fetch(`/api/tunnels/${resolvedParams.id}/ip`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_ipv4: clientIp,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      setSuccess(true);

      // Redirect after a short delay
      setTimeout(() => {
        router.push("/dashboard/tunnels");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update tunnel IP");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Update Tunnel IP</h1>
        <Button asChild variant="outline">
          <Link href="/dashboard/tunnels">Back to Tunnels</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Update Client IP for {resolvedParams.id}</CardTitle>
          <CardDescription>
            Update your client IPv4 address when it changes (recommended over deleting tunnels)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientIp">New Client IPv4 Address</Label>
              <Input
                id="clientIp"
                placeholder="Enter your new public IPv4 address"
                value={clientIp}
                onChange={(e) => setClientIp(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                This is only needed for SIT and GRE tunnels. WireGuard peers update their endpoint automatically.
              </p>
            </div>

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}

            {success && (
              <div className="text-sm text-green-600">
                Client IP updated successfully! Redirecting...
              </div>
            )}

            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Updating..." : "Update IP Address"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="bg-muted p-4 rounded-md">
        <h3 className="font-semibold mb-2">Important Notes:</h3>
        <ul className="list-disc pl-5 space-y-2 text-sm">
          <li>
            <strong>Recommended approach:</strong> Updating your IP address is the recommended way to handle IP changes
            instead of deleting and creating a new tunnel.
          </li>
          <li>
            <strong>Preserve your allocation:</strong> This method preserves your IPv6 prefix allocations and counts
            against your lifetime limit of 2 tunnels.
          </li>
          <li>
            <strong>Client reconfiguration:</strong> After updating, you'll need to reconfigure your client with the new IP
            using the commands provided in the tunnel configuration.
          </li>
          <li>
            <strong>Brief downtime:</strong> The tunnel will be temporarily unavailable during the update process,
            but will resume operation once the update is complete.
          </li>
        </ul>
      </div>
    </div>
  );
}
