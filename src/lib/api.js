// Fetch wrapper that attaches the site password and handles 401s.
export async function apiFetch(path, options = {}) {
  const key = localStorage.getItem('siteKey') || ''
  const headers = { ...(options.headers || {}), 'x-site-key': key }
  const res = await fetch(path, { ...options, headers })
  if (res.status === 401) {
    localStorage.removeItem('siteKey')
    throw new Error('密码不对或已失效，请刷新页面重新输入密码')
  }
  return res
}
