import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';

const css=readFileSync(join(process.cwd(),'src/owner-operations.css'),'utf8');
const page=readFileSync(join(process.cwd(),'src/pages/DriveMode.tsx'),'utf8');

describe('Drive Mode responsive and safety contract',()=>{
 it('covers narrow phones through wide desktop without fixed page width',()=>{
  expect(css).toContain('.drive-page{width:min(1180px,100%);max-width:none');
  expect(css).toContain('@media(max-width:760px)');
  expect(css).toContain('@media(max-width:390px)');
  expect(css).toContain('@media(max-width:330px)');
  expect(css).toContain('env(safe-area-inset-top)');
 });
 it('keeps every primary, utility, reset, and sheet close action at least 44 pixels',()=>{
  expect(css).toMatch(/\.drive-home-link\{[^}]*min-height:44px/);
  expect(css).toMatch(/\.drive-utility-actions \.button\{[^}]*min-height:48px/);
  expect(css).toMatch(/\.drive-stage-action\{[^}]*min-height:72px/);
  expect(css).toMatch(/\.drive-reset\{[^}]*min-height:44px/);
  expect(css).toMatch(/\.drive-sheet \.icon-button\{[^}]*min-width:44px;min-height:44px/);
 });
 it('uses 12-hour formatters and never routes Drive details into Requests',()=>{
  expect(page).toContain('formatTime(request.pickupTime)');
  expect(page).toContain('formatDateTime(session.updatedAt)');
  expect(page).toContain('setDetailsOpen(true)');
  expect(page).not.toContain('to={`/requests/');
  expect(page).toContain('Back to Home');
  expect(page).toContain("const completesRide=(action==='arrive_destination'&&!hasBookedReturn)||action==='arrive_return_stop'");
  expect(page).toContain("action:'start_booked_return'");
  expect(page).toContain("action:'arrive_return_stop'");
 });
 it('discloses foreground limitations and keeps estimated and actual mileage distinct',()=>{
  expect(page).toContain('Foreground tracking only.');
  expect(page).toContain('No Google route lookup is used for actual miles.');
  expect(page).toContain('Route estimate');
  expect(page).toContain('Actual drive record');
 });
});
