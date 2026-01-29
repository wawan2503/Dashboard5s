let bootstrapPromise;

function clearAuthParamsFromUrl() {
  const { hash, search, pathname } = window.location;
  const looksLikeAuthResponse =
    /[?#](code|state|error|error_description|client_info)=/i.test(hash) ||
    /[?#](code|state|error|error_description|client_info)=/i.test(search);

  if (!looksLikeAuthResponse) return;

  try {
    window.history.replaceState({}, document.title, pathname + window.location.search.replace(/([?&])(code|state|error|error_description|client_info)=[^&]*&?/gi, "$1").replace(/[?&]$/, ""));
  } catch {
    // ignore
  }
}

export function ensureMsalReady(instance) {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    await instance.initialize();

    // Handle redirect response (if any).
    let response;
    try {
      response = await instance.handleRedirectPromise();
    } catch (e) {
      const code = e?.errorCode || e?.code;
      if (code === "no_token_request_cache_error") {
        // A redirect response is present, but the matching request cache is missing (e.g. storage cleared).
        // Clean the URL and continue by falling back to existing accounts in cache.
        clearAuthParamsFromUrl();
        response = null;
      } else {
        throw e;
      }
    }
    if (response?.account) {
      instance.setActiveAccount(response.account);
      return;
    }

    // Pick a persisted account if available.
    const existing = instance.getAllAccounts();
    if (existing.length > 0) {
      instance.setActiveAccount(existing[0]);
    }
  })();

  return bootstrapPromise;
}
