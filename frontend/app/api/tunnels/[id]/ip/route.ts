import { NextResponse } from 'next/server';
import { TunnelResponse, UpdateTunnelIpRequest } from '@/types/api';
import { requireAuthenticatedHex4Id } from '@/utils/tunnel-access';
import { getTunnelbrokerApiKey, getTunnelbrokerApiUrl } from '@/utils/backend-api';

/**
 * PATCH /api/tunnels/[id]/ip - Update tunnel IP
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthenticatedHex4Id();
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }

    const { id: tunnelId } = await params;
    const body: UpdateTunnelIpRequest = await request.json();

    // Validate IP address
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    if (!ipv4Regex.test(body.client_ipv4) ||
        body.client_ipv4.split('.').map(part => parseInt(part, 10)).some(part => part < 0 || part > 255)) {
      return NextResponse.json(
        { error: 'Invalid IPv4 address format.' },
        { status: 400 }
      );
    }

    const apiUrl = getTunnelbrokerApiUrl();
    const detailResponse = await fetch(`${apiUrl}/tunnels/${tunnelId}?user_id=${auth.hex4Id}`, {
      method: 'GET',
      headers: {
        'X-API-Key': getTunnelbrokerApiKey(),
      },
    });

    if (!detailResponse.ok) {
      let errorMessage = `API error: ${detailResponse.status}`;
      try {
        const errorData = await detailResponse.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        console.error('Failed to parse tunnel ownership response:', e);
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: detailResponse.status }
      );
    }

    const detailData: TunnelResponse = await detailResponse.json();
    if (detailData.tunnel.user_id !== auth.hex4Id) {
      return NextResponse.json(
        { error: 'You do not have access to this tunnel.' },
        { status: 403 }
      );
    }

    if (detailData.tunnel.type === 'wg') {
      return NextResponse.json(
        { error: 'WireGuard peers update their endpoint automatically. Manual client IP updates are not needed.' },
        { status: 400 }
      );
    }

    const response = await fetch(`${apiUrl}/tunnels/${tunnelId}/ip`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getTunnelbrokerApiKey(),
      },
      body: JSON.stringify({
        ...body,
        user_id: auth.hex4Id,
      }),
    });

    // Handle API errors
    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        console.error('Failed to parse update tunnel error response:', e);
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    // Return successful response
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating tunnel IP:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
