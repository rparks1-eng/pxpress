export function ownerEmailErrorMessage(code:string):string {
 const messages:Record<string,string>={
  OWNER_AAL2_REQUIRED:'Verify your identity with your authenticator to continue.',
  OWNER_AUTHENTICATION_REQUIRED:'Sign in again to check Gmail. This does not mean Gmail was disconnected.',
  OWNER_GMAIL_ACCESS_DENIED:'Your signed-in account could not access the owner Gmail connection.',
  OWNER_GMAIL_CONFIGURATION_UNAVAILABLE:'Gmail server configuration needs attention. Reconnecting will not fix this.',
  OWNER_GMAIL_RUNTIME_UNAVAILABLE:'Gmail connection could not be checked. Try again; no reconnection is needed yet.',
  OWNER_GMAIL_REFRESH_UNAVAILABLE:'Google is temporarily unavailable. Try again without reconnecting.',
  OWNER_GMAIL_RECONNECT_REQUIRED:'Google says the Gmail authorization expired or was revoked. Reconnect the approved account.',
 };
 return messages[code]||code;
}
