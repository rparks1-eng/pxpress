import { describe,expect,it } from 'vitest';
import { assertRedirectAllowed,GMAIL_SCOPES,GMAIL_SYNC_LIMITS,gmailRetryDelay,lockScreenEmailNotification,planHistoryRecovery,scopesFor,validOauthState,validPkceVerifier } from './oauth-policy';

describe('Gmail connection and sync policy',()=>{
  it('uses incremental least-privilege scopes without redundant grants',()=>{expect(scopesFor(['read'])).toEqual([GMAIL_SCOPES.read]);expect(scopesFor(['compose'])).toEqual([GMAIL_SCOPES.compose]);expect(scopesFor(['read','compose'])).toEqual([GMAIL_SCOPES.read,GMAIL_SCOPES.compose]);expect(scopesFor(['read','compose','modify'])).toEqual([GMAIL_SCOPES.modify])});
  it('requires bounded OAuth state and PKCE verifier',()=>{expect(validOauthState('a'.repeat(32))).toBe(true);expect(validOauthState('short')).toBe(false);expect(validPkceVerifier('x'.repeat(43))).toBe(true);expect(validPkceVerifier('x'.repeat(42))).toBe(false)});
  it('allowlists callback origin and path',()=>{expect(assertRedirectAllowed('https://preview.pxpressllc.com/api/email/google/callback',['https://preview.pxpressllc.com'])).toContain('preview.pxpressllc.com');expect(()=>assertRedirectAllowed('https://evil.test/api/email/google/callback',['https://preview.pxpressllc.com'])).toThrow(/origin/);expect(()=>assertRedirectAllowed('https://preview.pxpressllc.com/other',['https://preview.pxpressllc.com'])).toThrow(/path/)});
  it('caps retries and backoff',()=>{expect(GMAIL_SYNC_LIMITS.maxRetries).toBe(3);expect(gmailRetryDelay(0)).toBe(1000);expect(gmailRetryDelay(1,90)).toBe(60000);expect(()=>gmailRetryDelay(3)).toThrow(/limit/)});
  it('recovers missing history with a bounded full sync',()=>{expect(planHistoryRecovery({})).toEqual({mode:'bounded_full_sync',reason:'no_cursor'});expect(planHistoryRecovery({savedHistoryId:'4'})).toEqual({mode:'bounded_full_sync',reason:'history_gap'})});
  it('does not expose sender or customer data in lock-screen content',()=>{const notification=lockScreenEmailNotification({threadId:'thread-1',senderName:'Private Guest'});expect(JSON.stringify(notification)).not.toContain('Private Guest');expect(notification.body).toContain('Owner Desk')});
});
