import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('owner MFA contract',()=>{
  const auth=readFileSync(join(process.cwd(),'src/auth.tsx'),'utf8');
  const app=readFileSync(join(process.cwd(),'src/App.tsx'),'utf8');
  const page=readFileSync(join(process.cwd(),'src/pages/Mfa.tsx'),'utf8');
  it('enrolls and verifies a TOTP factor through Supabase Auth',()=>{
    expect(auth).toContain("factorType:'totp'");
    expect(auth).toContain('mfa.challengeAndVerify');
    expect(auth).toContain('getAuthenticatorAssuranceLevel');
  });
  it('requires a verified factor and AAL2 before protected routes render',()=>{
    expect(app).toContain('!mfa.verifiedFactorId');
    expect(app).toContain("mfa.readStatus==='unavailable'");
    expect(app).toContain("mfa.currentLevel!=='aal2'");
    expect(app).toContain('/mfa-challenge');
  });
  it('does not convert an MFA read failure into an unenrolled state',()=>{
    expect(auth).toContain("readStatus:'unavailable'");
    expect(auth).toContain('finally{setLoading(false)}');
    expect(auth).not.toContain('if(levelsError||factorsError){setMfa(emptyMfa);return;}');
  });
  it('starts enrollment only after an explicit owner action and offers recovery',()=>{
    expect(page).toContain('Start secure setup');
    expect(page).toContain('onClick={start}');
    expect(page).toContain('Sign out and return to login');
    expect(page).not.toMatch(/useEffect\([^;]*startMfaEnrollment/);
  });
});
