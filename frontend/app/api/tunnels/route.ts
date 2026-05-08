import { NextResponse } from 'next/server';
import { CreateTunnelRequest, TunnelResponse } from '@/types/api';
import { requireAuthenticatedHex4Id } from '@/utils/tunnel-access';
import { getTunnelbrokerApiKey, getTunnelbrokerApiUrl } from '@/utils/backend-api';

/**
 * POST /api/tunnels - Create a new tunnel
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedHex4Id();
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }

    // Parse request body
    const body: CreateTunnelRequest = await request.json();

    // Validate user ID
    if (!/^[0-9a-fA-F]{4}$/.test(body.user_id)) {
      console.error('Invalid userId format. Must be exactly 4 characters.');
      return NextResponse.json(
        { error: 'Invalid user ID format. Please try again later.' },
        { status: 400 }
      );
    }

    if (body.user_id !== auth.hex4Id) {
      return NextResponse.json(
        { error: 'You can only create tunnels for your own account.' },
        { status: 403 }
      );
    }

    // Validate IP address only for SIT/GRE. WireGuard learns the client endpoint automatically.
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    if (body.type !== 'wg') {
      if (!body.client_ipv4 || !ipv4Regex.test(body.client_ipv4) ||
          body.client_ipv4.split('.').map(part => parseInt(part, 10)).some(part => part < 0 || part > 255)) {
        return NextResponse.json(
          { error: 'Invalid IPv4 address format.' },
          { status: 400 }
        );
      }
    }

    // Forward request to backend API
    const apiUrl = getTunnelbrokerApiUrl();
    const payload = body.type === 'wg'
      ? { type: body.type, user_id: body.user_id }
      : body;

    const response = await fetch(`${apiUrl}/tunnels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getTunnelbrokerApiKey(),
      },
      body: JSON.stringify(payload),
    });

    // Handle API errors
    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;

        if (errorMessage.includes('could not generate a unique third prefix')) {
          errorMessage = 'The system is currently unable to create new tunnels. Please try again later or contact support.';
        }

      } catch (e) {
        console.error('Failed to parse create tunnel error response:', e);
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    // Return successful response
    const data: TunnelResponse = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating tunnel:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
