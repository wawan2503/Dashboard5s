export const msalConfig = {
  auth: {
    clientId: "4b6c618c-4331-42fa-88e3-c82b80287bf6",
    authority: "https://login.microsoftonline.com/00e46b06-2e0f-4d1c-bdc8-bd294bd4a965",
    // Keep redirect stable for SPA auth. Make sure this exact URL is registered in Azure (SPA platform).
    redirectUri: window.location.origin + "/",
    postLogoutRedirectUri: window.location.origin + "/",
    // Avoid extra navigation quirks with hash routing.
    navigateToLoginRequestUrl: false,
  },
  // Persist session across refresh/reopen so users don't have to login repeatedly.
  cache: { cacheLocation: "localStorage" },
};

export const loginRequest = {
  scopes: ["User.Read"],
};

export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
};

// Note: if you deploy under a subpath, update redirectUri in Azure + code accordingly.
