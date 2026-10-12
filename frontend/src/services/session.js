const VERSION_KEY = 'paperloom:session-version';
const SIGNED_OUT_KEY = 'paperloom:signed-out';
let pendingMutation = Promise.resolve();

export function csrfToken() {
  const cookies = document.cookie.split(';').map(cookie => cookie.trim());
  for (const name of ['__Host-paperloom_csrf', 'paperloom_csrf']) {
    const cookie = cookies.find(value => value.startsWith(`${name}=`));
    if (cookie) return decodeURIComponent(cookie.slice(name.length + 1));
  }
  return '';
}

export function sessionVersion() {
  return localStorage.getItem(VERSION_KEY) || '';
}

export function signedOut() {
  return localStorage.getItem(SIGNED_OUT_KEY) === '1';
}

export function changeSession(out) {
  localStorage.setItem(VERSION_KEY, crypto.randomUUID());
  if (out) {
    localStorage.setItem(SIGNED_OUT_KEY, '1');
    localStorage.removeItem('user');
  } else {
    localStorage.removeItem(SIGNED_OUT_KEY);
  }
  localStorage.removeItem('token');
}

// Keep a late logout response from clearing cookies set by a newer login.
export function mutateSession(callback) {
  const result = pendingMutation.then(callback, callback);
  pendingMutation = result.catch(() => {});
  return result;
}

export function sessionStorageEvent(event) {
  return event.key === VERSION_KEY || event.key === SIGNED_OUT_KEY;
}
