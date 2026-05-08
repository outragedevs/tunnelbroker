/**
 * Client-side API service for tunnel operations
 * This uses the server-side route handlers instead of directly calling the backend API
 */

import { TunnelResponse, TunnelType } from '@/types/api';

/**
 * Creates a new tunnel
 */
export async function createTunnel(userId: string, tunnelType: TunnelType, clientIpv4: string): Promise<TunnelResponse> {
  try {
    console.log(`Creating tunnel with: userId=${userId}, type=${tunnelType}, clientIpv4=${clientIpv4}`);

    const response = await fetch('/api/tunnels', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: tunnelType,
        user_id: userId,
        client_ipv4: clientIpv4,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Tunnel created successfully:', data);
    return data;
  } catch (error) {
    console.error('Error creating tunnel:', error);
    throw error;
  }
}

/**
 * Updates a tunnel's client IP
 */
export async function updateTunnelIp(tunnelId: string, clientIpv4: string) {
  try {
    console.log(`Updating tunnel IP: tunnelId=${tunnelId}, clientIpv4=${clientIpv4}`);

    const response = await fetch(`/api/tunnels/${tunnelId}/ip`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_ipv4: clientIpv4,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Tunnel IP updated successfully:', data);
    return data;
  } catch (error) {
    console.error('Error updating tunnel IP:', error);
    throw error;
  }
}

/**
 * Deletes a tunnel
 */
export async function deleteTunnel(tunnelId: string) {
  try {
    console.log(`Deleting tunnel: tunnelId=${tunnelId}`);

    const response = await fetch(`/api/tunnels/${tunnelId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    console.log('Tunnel deleted successfully');
    return true;
  } catch (error) {
    console.error('Error deleting tunnel:', error);
    throw error;
  }
}

/**
 * Gets a tunnel's details
 */
export async function getTunnelDetails(tunnelId: string): Promise<TunnelResponse> {
  try {
    console.log(`Fetching details for tunnel ${tunnelId}`);

    const response = await fetch(`/api/tunnels/${tunnelId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Tunnel details fetched successfully');
    return data;
  } catch (error) {
    console.error('Error fetching tunnel details:', error);
    throw error;
  }
}
