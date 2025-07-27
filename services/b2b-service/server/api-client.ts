// API client for inter-service communication
const CORE_API_URL = process.env.CORE_API_URL || 'http://localhost:5003';
const SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || 'dev-service-key';

class ApiClient {
  private baseUrl: string;
  private serviceKey: string;

  constructor(baseUrl: string, serviceKey: string) {
    this.baseUrl = baseUrl;
    this.serviceKey = serviceKey;
  }

  private async request(method: string, endpoint: string, data?: any) {
    const url = `${this.baseUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Auth': this.serviceKey,
      },
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return null;
    } catch (error) {
      console.error(`API client error: ${method} ${endpoint}`, error);
      throw error;
    }
  }

  async get(endpoint: string) {
    return this.request('GET', endpoint);
  }

  async post(endpoint: string, data: any) {
    return this.request('POST', endpoint, data);
  }

  async put(endpoint: string, data: any) {
    return this.request('PUT', endpoint, data);
  }

  async patch(endpoint: string, data: any) {
    return this.request('PATCH', endpoint, data);
  }

  async delete(endpoint: string) {
    return this.request('DELETE', endpoint);
  }
}

export const apiClient = new ApiClient(CORE_API_URL, SERVICE_KEY);