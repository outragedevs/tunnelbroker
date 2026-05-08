import { NextResponse } from 'next/server';
import { TunnelResponse } from '@/types/api';
import { requireAuthenticatedHex4Id } from '@/utils/tunnel-access';
import { getTunnelbrokerApiKey, getTunnelbrokerApiUrl } from '@/utils/backend-api';

/**
 * GET /api/tunnels/[id] - Get tunnel details
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthenticatedHex4Id();
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }

    const { id: tunnelId } = await params;

    // Forward request to backend API
    const apiUrl = getTunnelbrokerApiUrl();
    const response = await fetch(`${apiUrl}/tunnels/${tunnelId}?user_id=${auth.hex4Id}`, {
      method: 'GET',
      headers: {
        'X-API-Key': getTunnelbrokerApiKey(),
      },
    });

    // Handle API errors
    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        console.error('Failed to parse tunnel detail error response:', e);
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    // Return successful response
    const data: TunnelResponse = await response.json();

    // Validate data structure
    if (!data || !data.tunnel || !data.commands) {
      console.error('Invalid data structure:', data);
      return NextResponse.json(
        { error: 'Invalid tunnel data format' },
        { status: 500 }
      );
    }

    if (data.tunnel.user_id !== auth.hex4Id) {
      return NextResponse.json(
        { error: 'You do not have access to this tunnel.' },
        { status: 403 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching tunnel details:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tunnels/[id] - Delete a tunnel
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuthenticatedHex4Id();
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }

    const { id: tunnelId } = await params;

    const apiUrl = getTunnelbrokerApiUrl();
    const response = await fetch(`${apiUrl}/tunnels/${tunnelId}?user_id=${auth.hex4Id}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': getTunnelbrokerApiKey(),
      },
    });

    // Handle API errors
    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        console.error('Failed to parse delete tunnel error response:', e);
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    // Return successful response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tunnel:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
