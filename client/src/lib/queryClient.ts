import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { requestBatcher } from "./request-batcher";

// Global CSRF token storage
let csrfToken: string | null = null;

// Function to fetch and cache CSRF token
const fetchCsrfToken = async (): Promise<string | null> => {
  try {
    const response = await fetch('/api/csrf-token', {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      csrfToken = data.csrfToken;
      return csrfToken;
    }
  } catch (error) {
    console.warn('Failed to fetch CSRF token:', error);
  }
  return null;
};

// Initialize CSRF token
fetchCsrfToken();

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Enhanced API Request with proper error handling
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  // Skip batching for cart API - needs immediate response for UX
  const skipBatching = url.includes('/api/cart') || url.includes('/api/wallet') || url.includes('/api/orders');
  
  // For GET requests without data, use the request batcher (except for cart/wallet/orders)
  if (method === 'GET' && !data && !skipBatching) {
    try {
      const responseData = await requestBatcher.batchRequest(url, method);
      return responseData;
    } catch (error) {
      // Fallback to regular fetch if batching fails
      console.warn('Request batching failed, falling back to regular fetch:', error);
    }
  }

  // For state-changing operations, ensure we have a CSRF token
  const needsCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);
  
  if (needsCsrf && !csrfToken) {
    await fetchCsrfToken();
  }

  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};

  // Add CSRF token for state-changing operations
  if (needsCsrf && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  // Regular fetch for POST/PUT/DELETE or when batching fails
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes default
      gcTime: 30 * 60 * 1000, // 30 minutes cache retention
      retry: (failureCount, error) => {
        // Don't retry on authentication errors
        if (error.message?.includes('401')) return false;
        return failureCount < 2; // Retry up to 2 times for other errors
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
    mutations: {
      retry: false, // Don't retry mutations to prevent duplicate operations
    },
  },
});
