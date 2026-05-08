import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getUserTunnels } from "@/utils/user-utils";
import { TunnelsList } from "./tunnels-list";

export default async function TunnelsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Get user tunnels and user data in one request
  const { data: tunnels, error, userData } = await getUserTunnels(user.id);

  // Get active_tunnels count from user data (with fallback to 0)
  const activeTunnels = userData?.active_tunnels || 0;

  // Log user data for debugging
  console.log('User data from API:', userData);

  // Maximum allowed tunnels
  const maxTunnels = 2;

  return (
    <div className="space-y-6">
      <TunnelsList
        tunnels={tunnels || []}
        error={error}
        activeTunnels={activeTunnels}
        maxTunnels={maxTunnels}
      />
    </div>
  );
}
