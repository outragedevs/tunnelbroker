"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";

export default function DeleteTunnelPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tunnels/${resolvedParams.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      router.push("/dashboard/tunnels");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tunnel");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Delete Tunnel</h1>
        <Button asChild variant="outline">
          <Link href="/dashboard/tunnels">Back to Tunnels</Link>
        </Button>
      </div>

      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="text-destructive" />
            <CardTitle>Delete Tunnel {resolvedParams.id}</CardTitle>
          </div>
          <CardDescription className="text-destructive">
            This action cannot be undone and may prevent creating new tunnels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            You are about to permanently delete tunnel <strong>{resolvedParams.id}</strong>.
            This will immediately terminate the tunnel connection and remove all associated
            configuration.
          </p>
          <p className="mt-2 text-destructive font-medium">
            Remember: You are limited to creating a maximum of 2 tunnels in total. If you've already
            created 2 tunnels (including this one), you will not be able to create any new tunnels
            after deletion.
          </p>
          <p className="mt-2">
            If your IP address has changed, we strongly recommend <Link href={`/dashboard/tunnels/${resolvedParams.id}/update-ip`} className="underline font-medium">updating your IP</Link> instead
            of deleting this tunnel.
          </p>

          {error && (
            <div className="mt-4 text-sm text-destructive">{error}</div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" asChild>
            <Link href="/dashboard/tunnels">Cancel</Link>
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? "Deleting..." : "Delete Tunnel"}
          </Button>
        </CardFooter>
      </Card>

      <div className="bg-destructive/10 p-4 rounded-md border border-destructive/20">
        <h3 className="font-semibold mb-2 text-destructive">Important Warning:</h3>
        <ul className="list-disc pl-5 space-y-2 text-sm">
          <li className="text-destructive font-medium">
            You are limited to creating a maximum of 2 tunnels in total. If you delete this tunnel and have already
            created 2 tunnels, you will <strong>not</strong> be able to create a new one.
          </li>
          <li>
            If your IP address has changed, consider <Link href={`/dashboard/tunnels/${resolvedParams.id}/update-ip`} className="underline font-medium">updating your IP</Link> instead of deleting the tunnel.
          </li>
          <li>The tunnel connection will be immediately terminated.</li>
          <li>All IPv6 prefixes assigned to this tunnel will be reclaimed.</li>
          <li>Your client will lose IPv6 connectivity through this tunnel.</li>
          <li>This action cannot be undone.</li>
        </ul>
      </div>
    </div>
  );
}
