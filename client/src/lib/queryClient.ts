import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { requestBatcher } from "./request-batcher";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// TIER 1 ENTERPRISE OPTIMIZATION: Enhanced API Request with Batching Support
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Skip batching for cart API - needs immediate response for UX
  const skipBatching = url.includes('/api/cart') || url.includes('/api/wallet') || url.includes('/api/orders');
  
  // For GET requests without data, use the request batcher (except for cart/wallet/orders)
  if (method === 'GET' && !data && !skipBatching) {
    try {
      const responseData = await requestBatcher.batchRequest(url, method);
      // Create a mock Response object with the batched data
      return {
        ok: true,
        status: 200,
        json: async () => responseData,
        text: async () => JSON.stringify(responseData),
        statusText: 'OK'
      } as Response;
    } catch (error) {
      // Fallback to regular fetch if batching fails
      console.warn('Request batching failed, falling back to regular fetch:', error);
    }
  }

  // Regular fetch for POST/PUT/DELETE or when batching fails
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
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
