let authToken = '';

export function setAuthToken(token) {
  authToken = `${token || ''}`.trim();
}

export function getAuthToken() {
  return authToken;
}

export function buildAuthHeaders(headers = {}) {
  const token = getAuthToken();
  if (!token) return { ...(headers || {}) };
  return {
    ...(headers || {}),
    Authorization: `Bearer ${token}`,
  };
}

