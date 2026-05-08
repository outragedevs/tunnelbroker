import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getUserHex4Id } from "@/utils/user-utils";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Get user hex4 ID
  const hex4Id = await getUserHex4Id(user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">User ID:</span>
                <span className="font-mono">{hex4Id || "Not assigned"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span>{user.email}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tunnel Management</CardTitle>
            <CardDescription>Manage your IPv6 tunnels</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>You can create up to 2 tunnels for free.</p>
            <Button asChild>
              <Link href="/dashboard/tunnels">Manage Tunnels</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Information</CardTitle>
          <CardDescription>About TunnelBroker</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            TunnelBroker provides free IPv6 tunneling services to users who want to connect to the IPv6 Internet via their existing IPv4 connection.
          </p>
          <div className="space-y-2">
            <h3 className="font-semibold">Important Notes:</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>This is a free service with no guarantees of uptime or performance.</li>
              <li>Abuse of the service will result in immediate termination of your account.</li>
              <li>Security restrictions may apply to protect our infrastructure.</li>
              <li>For technical support, please refer to the documentation.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
