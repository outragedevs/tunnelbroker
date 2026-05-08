import { createClient } from "@/utils/supabase/server";
import { Tunnel } from "@/types/api";
import { getTunnelbrokerApiKey, getTunnelbrokerApiUrl } from "@/utils/backend-api";

/**
 * Gets the hex4 ID for a user from the public.relay table
 * If it doesn't exist, creates a new entry
 */
export async function getUserHex4Id(authUserId: string): Promise<string | null> {
  const supabase = await createClient();

  // Check if user already has a hex4 ID
  const { data: relayData } = await supabase
    .from('relay')
    .select('generated_hex4')
    .eq('auth_user_id', authUserId)
    .single();

  if (relayData) {
    return relayData.generated_hex4;
  }

  // If not, generate a new hex4 ID
  // This is a simple implementation - in a real app, you'd want to ensure uniqueness
  const hex4 = generateHex4Id();

  // Insert the new relay entry
  const { error: insertError } = await supabase
    .from('relay')
    .insert({
      auth_user_id: authUserId,
      generated_hex4: hex4
    });

  if (insertError) {
    console.error('Error creating relay entry:', insertError);
    return null;
  }

  // Create the public.users entry
  const { error: usersError } = await supabase
    .from('users')
    .insert({
      id: hex4,
      created_tunnels: 0,
      active_tunnels: 0
    });

  if (usersError) {
    console.error('Error creating users entry:', usersError);
    return null;
  }

  return hex4;
}

// getUserInfo function has been removed as user data is now returned by getUserTunnels

/**
 * Updates the created_tunnels count for a user
 */
export async function incrementCreatedTunnels(userId: string) {
  const supabase = await createClient();

  // Get the hex4 ID
  const hex4Id = await getUserHex4Id(userId);

  if (!hex4Id) {
    return { success: false, error: 'Could not get user ID' };
  }

  // Get current user info
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('created_tunnels')
    .eq('id', hex4Id)
    .single();

  if (userError) {
    console.error('Error fetching user info:', userError);
    return { success: false, error: 'Failed to fetch user information' };
  }

  // Increment created_tunnels
  const { error: updateError } = await supabase
    .from('users')
    .update({ created_tunnels: (userData.created_tunnels || 0) + 1 })
    .eq('id', hex4Id);

  if (updateError) {
    console.error('Error updating created_tunnels:', updateError);
    return { success: false, error: 'Failed to update tunnel count' };
  }

  return { success: true, error: null };
}

/**
 * Generates a random hex4 ID (4 characters hexadecimal)
 */
function generateHex4Id(): string {
  return Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, '0');
}

/**
 * Gets the user's active tunnels and user info using the /tunnels/user/{user_id} endpoint
 * The endpoint now returns both tunnels and user_info with created_tunnels and active_tunnels
 */
export async function getUserTunnels(userId: string) {

  // Get the hex4 ID
  const hex4Id = await getUserHex4Id(userId);

  if (!hex4Id) {
    return {
      data: null,
      error: 'Could not get user ID',
      userData: null
    };
  }

  try {
    // Since this is a server component, we can directly call the backend API
    const apiUrl = getTunnelbrokerApiUrl();
    const apiKey = getTunnelbrokerApiKey();

    const response = await fetch(`${apiUrl}/tunnels/user/${hex4Id}`, {
      headers: {
        'X-API-Key': apiKey || '',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    // Get the response which now includes tunnels and user_info
    const apiResponse = await response.json();

    // Extract the tunnels array
    const tunnelsArray = apiResponse.tunnels || [];

    // Extract user info
    const userInfo = apiResponse.user_info || { created_tunnels: 0, active_tunnels: 0 };

    // Extract just the tunnel data from each object for compatibility with the UI
    const processedTunnels = tunnelsArray.map((item: any) => {
      const tunnel = item.tunnel as Tunnel;
      const { client_private_key, ...safeTunnel } = tunnel;
      return safeTunnel;
    });

    return {
      data: processedTunnels,
      error: null,
      userData: userInfo
    };
  } catch (error) {
    console.error('Error fetching tunnels and user data:', error);
    return {
      data: null,
      error: 'Failed to fetch tunnels and user data',
      userData: { created_tunnels: 0, active_tunnels: 0 }
    };
  }
}
