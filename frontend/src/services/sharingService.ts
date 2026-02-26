/**
 * Sharing Service - Client-side API for query sharing
 */

export type ExpirationOption = '1h' | '24h' | '7d' | '30d' | 'never';

export interface QueryResult {
  sql?: string;
  data: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  executionTime?: number;
}

export interface SharedQuery {
  id: string;
  queryText: string;
  queryResult: QueryResult;
  category?: 'healthcare' | 'marketing' | 'demographics' | 'geographic' | 'custom';
  createdAt: number;
  expiresAt: number;
  expirationOption: ExpirationOption;
  viewCount: number;
  createdBy?: string;
  title?: string;
  description?: string;
}

export interface ShareCreateResponse {
  success: boolean;
  shareId?: string;
  shareUrl?: string;
  expiresAt?: number;
  error?: string;
}

export interface ShareGetResponse {
  success: boolean;
  share?: SharedQuery;
  error?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Create a shareable link for query results
 */
export async function createShare(
  queryText: string,
  queryResult: QueryResult,
  options: {
    expiration?: ExpirationOption;
    category?: SharedQuery['category'];
    title?: string;
    description?: string;
    userId?: string;
  } = {}
): Promise<ShareCreateResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queryText,
        queryResult,
        expiration: options.expiration || '7d',
        category: options.category,
        title: options.title,
        description: options.description,
        userId: options.userId,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating share:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create share',
    };
  }
}

/**
 * Get a shared query by ID
 */
export async function getShare(shareId: string): Promise<ShareGetResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/share/${shareId}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting share:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get share',
    };
  }
}

/**
 * Get share metadata (preview)
 */
export async function getShareMetadata(shareId: string): Promise<{
  success: boolean;
  metadata?: {
    exists: boolean;
    title?: string;
    category?: string;
    createdAt?: number;
    expiresAt?: number;
    viewCount?: number;
    rowCount?: number;
  };
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/share/${shareId}/metadata`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting share metadata:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get metadata',
    };
  }
}

/**
 * Delete a share
 */
export async function deleteShare(
  shareId: string,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/share/${shareId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting share:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete share',
    };
  }
}

/**
 * Update share expiration
 */
export async function updateShareExpiration(
  shareId: string,
  expiration: ExpirationOption,
  userId?: string
): Promise<ShareCreateResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/share/${shareId}/expiration`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiration, userId }),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating share expiration:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update expiration',
    };
  }
}

/**
 * Get user's shares
 */
export async function getUserShares(
  userId: string,
  limit: number = 50
): Promise<{
  success: boolean;
  shares?: SharedQuery[];
  count?: number;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${API_BASE}/api/v1/share/user/${userId}?limit=${limit}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting user shares:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get shares',
    };
  }
}

/**
 * Copy share URL to clipboard
 */
export async function copyShareUrl(shareId: string): Promise<boolean> {
  try {
    const shareUrl = `${window.location.origin}/share/${shareId}`;
    await navigator.clipboard.writeText(shareUrl);
    return true;
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    return false;
  }
}

/**
 * Get full share URL
 */
export function getShareUrl(shareId: string): string {
  return `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${shareId}`;
}

/**
 * Format expiration for display
 */
export function formatExpiration(expirationOption: ExpirationOption): string {
  const labels: Record<ExpirationOption, string> = {
    '1h': '1 hour',
    '24h': '24 hours',
    '7d': '7 days',
    '30d': '30 days',
    'never': 'Never',
  };
  return labels[expirationOption];
}

/**
 * Format expiration timestamp for display
 */
export function formatExpiresAt(expiresAt: number): string {
  const now = Date.now();
  const diff = expiresAt - now;

  if (diff <= 0) {
    return 'Expired';
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 365) {
    return 'Never expires';
  } else if (days > 0) {
    return `Expires in ${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `Expires in ${hours} hour${hours > 1 ? 's' : ''}`;
  } else {
    const minutes = Math.floor(diff / (1000 * 60));
    return `Expires in ${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}
