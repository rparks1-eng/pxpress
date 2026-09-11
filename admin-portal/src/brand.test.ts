import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {pxpressLogo} from './brand';
describe('shared owner logo',()=>{
 it('uses the preserved same-origin transparent asset instead of an empty inline import',()=>{
  expect(pxpressLogo).toBe('/admin/assets/pxpress-header-logo-transparent-v2-DbKum852.png');
  for(const page of ['pages/Login.tsx','pages/Mfa.tsx','components/Shell.tsx']){
   const source=readFileSync(new URL(page,import.meta.url),'utf8');
   expect(source).toContain("import { pxpressLogo } from '../brand'");
   expect(source).not.toContain("from '../../../src/extensions/site/widgets/pxpress-exact-site/pxpress-header-logo");
  }
 });
});
