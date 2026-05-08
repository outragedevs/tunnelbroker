import { NextResponse } from 'next/server';
import { requireAuthenticatedHex4Id } from '@/utils/tunnel-access';
import { getTunnelbrokerApiKey, getTunnelbrokerApiUrl } from '@/utils/backend-api';

/**
 * GET /api/tunnels/user/[id] - Get tunnels for a specific user
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

    const { id: userId } = await params;
    if (userId !== auth.hex4Id) {
      return NextResponse.json(
        { error: 'You can only fetch tunnels for your own account.' },
        { status: 403 }
      );
    }

    // Forward request to backend API
    const apiUrl = getTunnelbrokerApiUrl();
    const response = await fetch(`${apiUrl}/tunnels/user/${userId}`, {
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
        console.error('Failed to parse user tunnel error response:', e);
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    // Return successful response
    const tunnelsArray = await response.json();
    return NextResponse.json(tunnelsArray);
  } catch (error) {
    console.error('Error fetching user tunnels:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
