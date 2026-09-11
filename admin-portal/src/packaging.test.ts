import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { adminSlashRedirect } from '../vite.config';

describe('Netlify admin subpath',()=>{
  it('builds assets and browser routes under /admin',async()=>{
    const [config,main]=await Promise.all([
      readFile(resolve(process.cwd(),'vite.config.ts'),'utf8'),
      readFile(resolve(process.cwd(),'src/main.tsx'),'utf8'),
    ]);
    expect(config).toMatch(/base:\s*['"]\/admin\/['"]/);
    expect(main).toMatch(/BrowserRouter basename="\/admin"/);
  });
  it('redirects the slashless local admin route without intercepting deep links',()=>{
    let handler:((request:{url?:string},response:{statusCode:number;setHeader:(name:string,value:string)=>void;end:()=>void},next:()=>void)=>void)|undefined;
    const use=vi.fn((value)=>{handler=value});
    (adminSlashRedirect.configureServer as Function)({middlewares:{use}});
    const setHeader=vi.fn(),end=vi.fn(),next=vi.fn(),response={statusCode:200,setHeader,end};
    handler?.({url:'/admin'},response,next);
    expect(response.statusCode).toBe(307);
    expect(setHeader).toHaveBeenCalledWith('Location','/admin/');
    expect(end).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
    handler?.({url:'/admin/requests'},response,next);
    expect(next).toHaveBeenCalledOnce();
  });
  it('keeps compact owner links at a full touch target',async()=>{
    const [directory,communications,operations]=await Promise.all([
      readFile(resolve(process.cwd(),'src/directory.css'),'utf8'),
      readFile(resolve(process.cwd(),'src/features/communications-center/communications-center.css'),'utf8'),
      readFile(resolve(process.cwd(),'src/owner-operations.css'),'utf8'),
    ]);
    expect(directory).toMatch(/customer-profile-link[^}]*min-height:44px/);
    expect(directory).toMatch(/not\(\.customer-profile-link\)[^}]*min-height:44px/);
    expect(communications).toMatch(/communications-history[^}]*a[^}]*min-height:44px/);
    expect(operations).toMatch(/needs-action-card[^}]*min-width:44px/);
  });
});
