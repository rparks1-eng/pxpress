import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';

describe('Owner Desk PWA notification assets',()=>{
  it('ships an installable scoped manifest with 192 and 512 icons',()=>{const manifest=JSON.parse(readFileSync(join(process.cwd(),'public/manifest.webmanifest'),'utf8'));expect(manifest).toMatchObject({start_url:'/admin/',scope:'/admin/',display:'standalone'});expect(manifest.icons.map((icon:{sizes:string})=>icon.sizes)).toEqual(['192x192','512x512']);expect(readFileSync(join(process.cwd(),'public/icon-192.png')).length).toBeGreaterThan(1000);expect(readFileSync(join(process.cwd(),'public/icon-512.png')).length).toBeGreaterThan(1000)});
  it('restricts notification clicks to safe Owner Desk routes',()=>{const worker=readFileSync(join(process.cwd(),'public/owner-notifications-sw.js'),'utf8');expect(worker).toContain('SAFE_OWNER_PATH');expect(worker).toContain("url.origin===self.location.origin");expect(worker).toContain("${self.location.origin}/admin/")});
  it('includes no customer details in the fallback lock-screen message',()=>{const worker=readFileSync(join(process.cwd(),'public/owner-notifications-sw.js'),'utf8');expect(worker).not.toMatch(/customerName|pickupAddress|phone|email/)})
  it('awaits navigation before focus and constrains tags to an opaque UUID',()=>{const worker=readFileSync(join(process.cwd(),'public/owner-notifications-sw.js'),'utf8');expect(worker).toContain("await owner.navigate(target)");expect(worker).toContain('UUID.test(String(payload.eventId))')});
});
