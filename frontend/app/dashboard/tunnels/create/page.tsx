import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { TunnelCreateForm } from "@/components/tunnel-create-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getUserHex4Id, getUserTunnels } from "@/utils/user-utils";

export default async function CreateTunnelPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Get user hex4 ID
  const hex4Id = await getUserHex4Id(user.id);

  if (!hex4Id) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Create Tunnel</h1>
        <div className="bg-destructive/10 p-4 rounded-md">
          <p className="text-destructive">
            Could not retrieve your user ID. Please try again later or contact support.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/tunnels">Back to Tunnels</Link>
        </Button>
      </div>
    );
  }

  // Get user tunnels and user data
  const { data: tunnels, userData, error } = await getUserTunnels(user.id);

  // Check if user has reached the tunnel creation limit (2 active tunnels)
  const activeTunnels = userData?.active_tunnels || 0;
  const maxTunnels = 2;

  console.log(`User ${hex4Id} has ${activeTunnels} active tunnels out of ${maxTunnels} allowed`);

  // If user has reached the limit, show error message
  if (activeTunnels >= maxTunnels) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Create Tunnel</h1>
        <div className="bg-destructive/10 p-4 rounded-md">
          <p className="text-destructive">
            You have reached the maximum number of active tunnels ({maxTunnels}).
            Delete an existing tunnel to create a new one.
          </p>
          <p className="mt-2 text-destructive">
            You have {activeTunnels} out of {maxTunnels} active tunnels.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/tunnels">Back to Tunnels</Link>
        </Button>
      </div>
    );
  }

  // If there was an error fetching user data
  if (error) {
    console.error('Error checking tunnels:', error);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Create Tunnel</h1>
        <div className="bg-destructive/10 p-4 rounded-md">
          <p className="text-destructive">
            Could not retrieve your tunnel information. Please try again later or contact support.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/tunnels">Back to Tunnels</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Create Tunnel</h1>
        <Button asChild variant="outline">
          <Link href="/dashboard/tunnels">Cancel</Link>
        </Button>
      </div>

      <TunnelCreateForm userId={hex4Id} />

      <div className="bg-muted p-4 rounded-md">
        <h3 className="font-semibold mb-2">Important Notes:</h3>
        <ul className="list-disc pl-5 space-y-2 text-sm">
          <li>
            <strong>Tunnel limit:</strong> You can have a maximum of 2 active tunnels at any time.
            You can delete existing tunnels and create new ones as needed.
          </li>
          <li>
            <strong>IP address management:</strong> For SIT and GRE you can update your existing tunnel if your public IPv4 changes.
            WireGuard updates its endpoint automatically after reconnect.
          </li>
          <li>
            <strong>Technical setup:</strong> Enter your correct public IPv4 address for SIT/GRE.
            Choose SIT for most use cases, GRE if you need specific routing capabilities, or WireGuard for modern encrypted tunnels without manual endpoint tracking.
          </li>
          <li>
            <strong>Configuration:</strong> After creation, you'll receive detailed configuration instructions
            for both server and client sides of your tunnel.
          </li>
        </ul>
      </div>
    </div>
  );
}
