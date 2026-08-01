// Fetch wrapper that attaches the device access token and handles 401s.
export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('accessToken') || ''
  const headers = { ...(options.headers || {}), 'x-user-token': token }
  const res = await fetch(path, { ...options, headers })
  if (res.status === 401) {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('accessUser')
    throw new Error('权限已失效（可能被移除了）。请刷新页面重新申请。')
  }
  return res
}
