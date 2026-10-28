export function createDeployment(appBase = '/', apiBase = '/api/', pollProgress = true) {
  const normalize = (path: string) => {
    if (!/^\/(?!\/)/.test(path) || /[?#\\]/.test(path)) throw new Error('Deployment paths must be same-origin absolute paths');
    return path.endsWith('/') ? path : path + '/';
  };
  appBase = normalize(appBase); apiBase = normalize(apiBase);
  return {
    appBase, pollProgress,
    api: (path: string) => apiBase + path.replace(/^\/+/, ''),
    share: (origin: string, query: string | URLSearchParams) => `${origin}${appBase}?${query}`,
  };
}

export const deployment = createDeployment(
  import.meta.env?.BASE_URL,
  import.meta.env?.VITE_ORBIT_API_BASE,
  import.meta.env?.VITE_ORBIT_POLL_PROGRESS !== 'false',
);
