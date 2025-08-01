import { useState, useEffect } from 'react';

interface CsrfToken {
  token: string | null;
  loading: boolean;
  error: string | null;
}

export function useCsrf(): CsrfToken {
  const [csrfData, setCsrfData] = useState<CsrfToken>({
    token: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch('/api/csrf-token', {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch CSRF token');
        }
        
        const data = await response.json();
        setCsrfData({
          token: data.csrfToken,
          loading: false,
          error: null
        });
      } catch (error) {
        setCsrfData({
          token: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    fetchCsrfToken();
  }, []);

  return csrfData;
}

// Utility function to add CSRF token to FormData
export function addCsrfToFormData(formData: FormData, csrfToken: string | null): FormData {
  if (csrfToken) {
    formData.append('_csrf', csrfToken);
  }
  return formData;
}

// Utility function to add CSRF token to request headers
export function getCsrfHeaders(csrfToken: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  return headers;
}