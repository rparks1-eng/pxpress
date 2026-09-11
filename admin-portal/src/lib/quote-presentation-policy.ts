/** Approved server receipt producer and independently observed Wix Pay Link route.
 * This controls presentation only. Owner MFA, current quote binding and provider
 * write authorization remain enforced by the server. Never enable from URL input.
 */
export const quotePresentationPolicy: Readonly<{
  producerId: string | null;
  allowedDestinations: readonly Readonly<{origin:string;pathPrefix:string}>[];
  maxVerificationAgeMs: number;
}> = Object.freeze({
  producerId: 'pxpress-send-quote-v2',
  allowedDestinations: Object.freeze([
    Object.freeze({origin:'https://pxpressmedia.wixsite.com',pathPrefix:'/pxpress-llc/_paylink/'}),
  ]),
  maxVerificationAgeMs: 120_000,
});
