import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';
import { channelPolicy,derivePushCapability } from './push-policy';

describe('owner push policy',()=>{
  it('keeps email for payments, failures, and failed push fallback',()=>{
    expect(channelPolicy('payment')).toEqual({inApp:true,push:true,email:true});
    expect(channelPolicy('system_error').email).toBe(true);
    expect(channelPolicy('upcoming')).toEqual({inApp:true,push:true,email:false});
  });
  it('never asks for notification permission on page load',()=>{
    const main=readFileSync(join(process.cwd(),'src/main.tsx'),'utf8');
    const settings=readFileSync(join(process.cwd(),'src/pages/NotificationSettings.tsx'),'utf8');
    expect(main).not.toContain('requestPushPermissionFromOwnerTap');
    expect(settings).toContain('onClick={enable}');
  });
  it('distinguishes unsupported, iOS not installed, ready, granted, and denied states',()=>{
    expect(derivePushCapability({notification:false,serviceWorker:true,pushManager:true,ios:false,standalone:false,permission:'default'}).permission).toBe('unsupported');
    expect(derivePushCapability({notification:true,serviceWorker:true,pushManager:true,ios:true,standalone:false,permission:'default'})).toMatchObject({supported:true,installed:false,permission:'default'});
    expect(derivePushCapability({notification:true,serviceWorker:true,pushManager:true,ios:true,standalone:true,permission:'default'})).toMatchObject({installed:true,permission:'default'});
    expect(derivePushCapability({notification:true,serviceWorker:true,pushManager:true,ios:false,standalone:true,permission:'granted'}).permission).toBe('granted');
    expect(derivePushCapability({notification:true,serviceWorker:true,pushManager:true,ios:false,standalone:true,permission:'denied'}).permission).toBe('denied');
  });
  it('ships explicit iPhone installation and reduced-motion guidance',()=>{
    const settings=readFileSync(join(process.cwd(),'src/pages/NotificationSettings.tsx'),'utf8');
    const css=readFileSync(join(process.cwd(),'src/features/owner-notifications/owner-notifications.css'),'utf8');
    expect(settings).toContain('Add to Home Screen');expect(settings).toContain('iPhone or iPad');
    expect(css).toContain('prefers-reduced-motion:reduce');
  });
});
