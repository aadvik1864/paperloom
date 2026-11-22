export function retiredSiteDestination(href) {
  const source = new URL(href);
  if (source.origin !== 'https://paperloom-frontend.onrender.com') return null;

  const destination = new URL('https://paperloom.onrender.com');
  destination.pathname = source.pathname;
  destination.search = source.search;
  destination.hash = source.hash;
  return destination.href;
}
