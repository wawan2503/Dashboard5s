import { InteractionRequiredAuthError } from "@azure/msal-browser";

export const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export const graphScopes = {
  profile: ["User.Read"],
  photo: ["User.Read"],
  mail: ["Mail.Read"],
  calendar: ["Calendars.Read"],
  files: ["Files.Read"],
  sharepoint: ["Sites.Read.All"],
};

export async function acquireAccessToken({ instance, account, scopes, redirectHintKey, onToken }) {
  if (!account) throw new Error("Belum login.");

  try {
    const tokenResponse = await instance.acquireTokenSilent({
      scopes,
      account,
    });
    if (typeof onToken === "function") onToken(tokenResponse);
    return tokenResponse.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      // Redirect keeps auth in the same tab.
      if (redirectHintKey) {
        try {
          sessionStorage.setItem(redirectHintKey, "1");
        } catch {
          // ignore
        }
      }
      await instance.acquireTokenRedirect({ scopes, account });
      throw new Error("Redirecting for auth...");
    }
    throw e;
  }
}

async function graphFetch({ accessToken, url, accept }) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(accept ? { Accept: accept } : {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph error ${res.status}: ${body}`);
  }

  return res;
}

export async function graphGetJson({ accessToken, url }) {
  const res = await graphFetch({ accessToken, url });
  return res.json();
}

export async function graphGetBlob({ accessToken, url, accept }) {
  const res = await graphFetch({ accessToken, url, accept });
  return res.blob();
}

export function graphMeUrl() {
  return `${GRAPH_BASE}/me?$select=id,displayName,mail,userPrincipalName,jobTitle,officeLocation,preferredLanguage`;
}

export function graphMePhotoUrl() {
  return `${GRAPH_BASE}/me/photo/$value`;
}

export function graphMyMessagesUrl() {
  return `${GRAPH_BASE}/me/messages?$top=5&$select=id,subject,receivedDateTime,from&$orderby=receivedDateTime desc`;
}

export function graphMyEventsUrl() {
  return `${GRAPH_BASE}/me/events?$top=5&$select=id,subject,start,end,organizer&$orderby=start/dateTime desc`;
}

export function graphMyDriveChildrenUrl() {
  return `${GRAPH_BASE}/me/drive/root/children?$top=10&$select=id,name,webUrl,lastModifiedDateTime,size`;
}

export function graphSiteByPathUrl(hostname, sitePath) {
  const cleanHost = String(hostname || "").trim();
  const cleanPath = String(sitePath || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  // Graph expects a trailing `:/` when addressing a site by path.
  return `${GRAPH_BASE}/sites/${cleanHost}:/${cleanPath}:/`;
}

export function graphListItemsUrl(siteId, listId, top = 200) {
  const cleanListId = String(listId || "").trim().replace(/^\{/, "").replace(/\}$/, "");
  return `${GRAPH_BASE}/sites/${siteId}/lists/${cleanListId}/items?$expand=fields&$top=${top}`;
}
