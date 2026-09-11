import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';

describe('local-first daily operations UI',()=>{
  const dashboard=readFileSync(join(process.cwd(),'src/pages/Dashboard.tsx'),'utf8');
  const drive=readFileSync(join(process.cwd(),'src/pages/DriveMode.tsx'),'utf8');
  const notifications=readFileSync(join(process.cwd(),'src/pages/Notifications.tsx'),'utf8');
  it('shows real today data and never calculates mileage from the overview',()=>{expect(dashboard).toContain('Today’s schedule');expect(dashboard).toContain('todaysRides');expect(dashboard).toContain('Next pickup');expect(dashboard).not.toContain('calculateRouteEstimate')});
  it('keeps protected request writes bounded while the detailed drive record remains device-local',()=>{expect(drive).toContain("transitionRequest(ride.id,requestVersion.current,'in_progress'");expect(drive).toContain("completePaidRide({...ride,version:requestVersion.current},'auto')");expect(drive).toContain('transitionDriveSession');expect(drive).toContain('Saved safely on this device');expect(drive).toContain('No Google route lookup is used for actual miles.');expect(drive).not.toMatch(/sendEmail|createInvoice|createPayment/) });
  it('routes notification settings separately without sending from the list',()=>{expect(notifications).toContain('/notification-settings');expect(notifications).toContain('useOwnerNotifications');expect(notifications).not.toMatch(/fetch\(|functions\.invoke|sendEmail/)});
});
