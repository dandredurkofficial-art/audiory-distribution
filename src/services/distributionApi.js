/**
 * Production Distribution Engine & Provider Abstraction
 */

const API_CONFIG = {
  baseUrl: "https://your-cloud-run-backend.a.run.app/v1",
  timeout: 15000,
};

class DistributionService {
  constructor() {
    this.token = localStorage.getItem("audiory_session_token");
  }

  getHeaders() {
    return {
      "Content-Type": "application/json",
      "Authorization": this.token ? `Bearer ${this.token}` : "",
      "X-Platform-Client": "audiory-web-production"
    };
  }

  async request(endpoint, options = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), API_CONFIG.timeout);
    
    try {
      const response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
        ...options,
        headers: { ...this.getHeaders(), ...options.headers },
        signal: controller.signal
      });
      clearTimeout(id);
      
      if (response.status === 401) {
        this.logout();
        window.location.href = '/login/index.html';
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "API Execution Failure");
      return data;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  // --- AUTHENTICATION ---
  async login(email, password) {
    const data = await this.request('/auth/token', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    this.token = data.access_token;
    localStorage.setItem("audiory_session_token", data.access_token);
    return data;
  }

  logout() {
    this.token = null;
    localStorage.removeItem("audiory_session_token");
  }

  // --- CATALOG & TOOLOST AGGREGATOR SYNC ---
  async getCatalog(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/catalog/releases?${queryString}`);
  }

  async submitRelease(payload) {
    // Schema translation layer for provider interoperability
    const providerPayload = {
      title: payload.title,
      version: payload.version || "",
      primary_artists: payload.artists,
      genre: payload.genre,
      subgenre: payload.subgenre,
      label_id: payload.labelId,
      release_date: payload.releaseDate,
      upc: payload.upc || null,
      tracks: payload.tracks.map(track => ({
        title: track.title,
        isrc: track.isrc || null,
        explicit: track.explicit,
        audio_file_id: track.audioFileId,
        writers: track.writers,
        publishers: track.publishers
      })),
      splits: payload.splits
    };

    return this.request('/catalog/submit', {
      method: 'POST',
      body: JSON.stringify(providerPayload)
    });
  }

  // --- ANALYTICS & ROYALTIES ---
  async getRoyaltyOverview() {
    return this.request('/royalties/summary');
  }

  async getStreamAnalytics(period = '30d') {
    return this.request(`/analytics/streams?period=${period}`);
  }
}

export const distributionApi = new DistributionService();
