import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { authStorageKeys, loginRequest } from "./authConfig.js";

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

function loadLoginHint() {
  try {
    return localStorage.getItem(authStorageKeys.loginHint) || "";
  } catch {
    return "";
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
      return;
    }

    // If MSAL cache is empty, try SSO using the last known username to avoid interactive login after restart.
    // This can still fail due to tenant policies (sign-in frequency), blocked third-party cookies, etc.
    const loginHint = loadLoginHint();
    if (!loginHint) return;

    try {
      const ssoResponse = await instance.ssoSilent({ ...loginRequest, loginHint });
      if (ssoResponse?.account) instance.setActiveAccount(ssoResponse.account);
    } catch (e) {
      if (e instanceof InteractionRequiredAuthError) return;
      const code = e?.errorCode || e?.code;
      if (code === "login_required" || code === "interaction_required" || code === "consent_required") return;
      // Unexpected error: let it surface (helps debugging misconfigurations).
      throw e;
    }
  })();

  return bootstrapPromise;
}
