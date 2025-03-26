addEventListener('fetch', event => {
    event.respondWith(handleRequest(event));
  });
  
  async function handleRequest(event) {
    const url = new URL(event.request.url);
    const pathname = url.pathname;
  
    let backendUrl;
  
    if (pathname.startsWith('/v1/chat')) {
      backendUrl = 'http://cradleintro.top:5001';
    } else if (pathname.startsWith('/v1/imagen')) {
      backendUrl = 'http://cradleintro.top:5000';
    } else if (pathname.startsWith('/v1/license')) {
      backendUrl = 'http://cradleintro.top:5000';
    } else if (pathname.startsWith('/v1/search')) {
      backendUrl = 'http://cradleintro.top:5002';
    } else {
      backendUrl = 'http://cradleintro.top';
    }
  
    if (backendUrl) {
      try {
        const modifiedRequest = new Request(backendUrl + pathname + url.search, {
          method: event.request.method,
          headers: event.request.headers,
          body: event.request.body,
          redirect: 'manual'
        });
  
        const response = await fetch(modifiedRequest);
        return response;
      } catch (error) {
        console.error("Fetch error:", error);
        return new Response('Internal Server Error', { status: 500 });
      }
    } else {
      return new Response('Not Found', { status: 404 });
    }
  }