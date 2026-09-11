import {describe,expect,it} from 'vitest';
import {safeOwnerMfaReturnPath} from './mfa-return';

describe('owner email MFA return path',()=>{
  it('allows exact supported owner sections and valid request details only',()=>{
    for(const safe of ['/email','/calendar','/notifications'])expect(safeOwnerMfaReturnPath(safe)).toBe(safe);
    expect(safeOwnerMfaReturnPath('/requests/123e4567-e89b-12d3-a456-426614174000')).toBe('/requests/123e4567-e89b-12d3-a456-426614174000');
    for(const unsafe of [null,'','/admin/email','//evil.example','https://evil.example','/requests','/requests/not-a-uuid','/requests/123e4567-e89b-12d3-c456-426614174000'])expect(safeOwnerMfaReturnPath(unsafe)).toBe('/');
  });
  it('rejects notification and calendar suffixes, nested paths, encodings and external destinations',()=>{
    for(const path of ['/calendar','/notifications'])for(const unsafe of [path+'/',path+'/details',path+'/..',path+'?next=https://evil.example',path+'#x',path+'\n','/admin'+path,'https://pxpressllc.com/admin'+path,'//evil.example'+path,encodeURIComponent(path),path.replace('/','\\')])expect(safeOwnerMfaReturnPath(unsafe)).toBe('/');
    for(const unsafe of ['/settings','/customers','/Calendar','/Notifications','javascript:alert(1)'])expect(safeOwnerMfaReturnPath(unsafe)).toBe('/');
  });
});
