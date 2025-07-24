/**
 * Utilities for encoding/decoding SQL queries in URL parameters
 * Uses base64 URL-safe encoding for sharing query analysis links
 */

/**
 * Encodes a SQL query to be URL-safe using base64 encoding
 * @param query - The SQL query string to encode
 * @returns Base64 URL-safe encoded string
 */
export const encodeQueryForUrl = (query: string): string => {
  if (!query.trim()) return '';
  
  // Convert to base64 and make it URL-safe
  const base64 = btoa(unescape(encodeURIComponent(query)));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

/**
 * Decodes a base64 URL-safe encoded query parameter back to SQL string
 * @param encodedQuery - The base64 URL-safe encoded query
 * @returns Decoded SQL query string or empty string if invalid
 */
export const decodeQueryFromUrl = (encodedQuery: string): string => {
  if (!encodedQuery) return '';
  
  try {
    // Restore base64 padding and characters
    let base64 = encodedQuery
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }
    
    // Decode from base64
    const decoded = atob(base64);
    return decodeURIComponent(escape(decoded));
  } catch (error) {
    console.warn('Failed to decode query from URL:', error);
    return '';
  }
};

/**
 * Updates the current URL with the encoded query parameter
 * @param query - The SQL query to encode and add to URL
 */
export const updateUrlWithQuery = (query: string): void => {
  const url = new URL(window.location.href);
  
  if (query.trim()) {
    const encodedQuery = encodeQueryForUrl(query);
    url.searchParams.set('q', encodedQuery);
  } else {
    url.searchParams.delete('q');
  }
  
  // Update URL without triggering a page reload
  window.history.replaceState({}, '', url.toString());
};

/**
 * Reads the query parameter from the current URL and decodes it
 * @returns Decoded SQL query string or empty string if no query parameter
 */
export const getQueryFromUrl = (): string => {
  const params = new URLSearchParams(window.location.search);
  const encodedQuery = params.get('q');
  
  if (!encodedQuery) return '';
  
  return decodeQueryFromUrl(encodedQuery);
};