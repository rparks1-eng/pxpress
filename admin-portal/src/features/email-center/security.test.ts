import { describe,expect,it } from 'vitest';
import { attachmentPolicy,isValidEmail,parseRecipients,redactEmailLog,safeLinkDetails,safeOwnerMatch,sanitizeEmailHtml,validateAttachmentAccess,validateSendReceipt } from './security';
import { pxpressEmailTemplateFixture } from './fixtures/pxpress-template';

describe('owner email security',()=>{
  it('removes scripts, handlers, forms, and iframes while retaining safe presentation styles',()=>{
    const safe=sanitizeEmailHtml('<p style="color:red" onclick="steal()">Hello<script>steal()</script><iframe src="https://evil.test"></iframe><form><input></form></p>','Hello');
    expect(safe.html).toContain('Hello');expect(safe.html).toContain('style="color:red"');expect(safe.html).not.toMatch(/script|iframe|form|input|onclick/i);
  });
  it('blocks remote images by default and allows an explicit per-message load',()=>{
    const blocked=sanitizeEmailHtml('<img src="https://tracker.test/pixel.gif"><p>Body</p>','Body');
    expect(blocked.blockedRemoteImages).toBe(1);expect(blocked.html).not.toContain('tracker.test');
    const loaded=sanitizeEmailHtml('<img src="https://images.test/photo.jpg">','',{},true);
    expect(loaded.html).toContain('https://images.test/photo.jpg');
  });
  it('renders known CID images and blocks unknown CID content',()=>{
    const body=sanitizeEmailHtml('<img src="cid:logo"><img src="cid:unknown">','',{'logo':'blob:https://pxpressllc.com/logo'});
    expect(body.inlineImages).toBe(1);expect(body.html).toContain('blob:https://pxpressllc.com/logo');expect(body.html).toContain('data-email-image-blocked="true"');
    const hostile=sanitizeEmailHtml('<img src="cid:logo">','',{'logo':'javascript:alert(1)'});
    expect(hostile.inlineImages).toBe(0);expect(hostile.documentHtml).not.toContain('javascript:');
  });
  it('keeps safe links with destination disclosure and blocks suspicious links',()=>{
    const safe=sanitizeEmailHtml('<a href="https://example.com/pay">Pay</a><a href="javascript:alert(1)">Bad</a>','');
    expect(safe.html).toContain('data-destination-domain="example.com"');expect(safe.html).not.toContain('href=');expect(safe.html).not.toContain('javascript:');expect(safe.links).toEqual([{href:'https://example.com/pay',domain:'example.com',external:true}]);
    expect(safeLinkDetails('https://example.com/pay')).toMatchObject({safe:true,external:true,domain:'example.com'});
    expect(safeLinkDetails('https://127.0.0.1/pay')).toMatchObject({safe:false,suspicious:true});
    expect(safeLinkDetails('http://example.com/pay')).toMatchObject({safe:false,suspicious:true});
  });
  it('preserves the visual structure of the Pxpress template inside a locked document shell',()=>{
    const safe=sanitizeEmailHtml(pxpressEmailTemplateFixture,'We received your ride request.');
    expect(safe.documentHtml).toContain('background:#050505');
    expect(safe.documentHtml).toContain('.letter{width:600px');
    expect(safe.documentHtml).toContain('@media(max-width:620px)');
    expect(safe.html).toContain('<h1>We received your ride request.</h1>');
    expect(safe.html).toContain('class="cta"');
    expect(safe.blockedRemoteImages).toBe(1);
    expect(safe.documentHtml).toContain("default-src 'none'");
    expect(safe.documentHtml).toContain("form-action 'none'");
    expect(safe.documentHtml).not.toContain('href=');
  });
  it('neutralizes hostile CSS, navigation, active content, and remote resources in one message',()=>{
    const safe=sanitizeEmailHtml(`<style>@import 'https://evil.test/a.css';@font-face{font-family:x;src:url(https://evil.test/f.woff)}.ok{color:#d1aa5a;background:url(https://evil.test/t.gif)}a:visited{color:red}</style><div class="ok" style="width:600px;background-image:url(https://evil.test/x)"><a href="https://example.com">Open</a><img src="data:image/svg+xml;base64,PHN2Zz4="><img src="https://evil.test/pixel"><video src="https://evil.test/v"></video><script>alert(1)</script><form action="https://evil.test"><input></form></div>`,'Open');
    expect(safe.documentHtml).toContain('color:#d1aa5a');
    expect(safe.documentHtml).not.toMatch(/@import|@font-face|evil\.test|<script|<form|<input|<video|data:image\/svg\+xml|href=/i);
    expect(safe.blockedRemoteImages).toBe(1);
    expect(safe.links).toHaveLength(1);
  });
  it('validates and deduplicates recipients',()=>{
    expect(isValidEmail('owner@example.com')).toBe(true);expect(()=>parseRecipients('bad address')).toThrow(/Check this email/);
    expect(parseRecipients('Guest <GUEST@example.com>, guest@example.com')).toEqual([{name:'Guest',email:'guest@example.com'}]);
  });
  it('blocks executable and oversized attachments',()=>{
    expect(attachmentPolicy({id:'1',name:'invoice.exe',mimeType:'application/octet-stream',size:200})).toMatchObject({allowed:false});
    expect(attachmentPolicy({id:'2',name:'large.pdf',mimeType:'application/pdf',size:21*1024*1024})).toMatchObject({allowed:false});
    expect(attachmentPolicy({id:'3',name:'receipt.pdf',mimeType:'application/pdf',size:1200})).toMatchObject({allowed:true});
    expect(attachmentPolicy({id:'4',name:'invoice.html',mimeType:'text/html',size:1200})).toMatchObject({allowed:false});
    expect(attachmentPolicy({id:'5',name:'logo.svg',mimeType:'image/svg+xml',size:1200})).toMatchObject({allowed:false});
    expect(attachmentPolicy({id:'6',name:'renamed.txt',mimeType:'application/xhtml+xml',size:1200})).toMatchObject({allowed:false});
  });
  it('accepts only short-lived access through the authenticated attachment proxy',()=>{const now=new Date('2026-09-02T20:00:00Z'),origins=['https://preview.pxpressllc.com'];expect(validateAttachmentAccess('https://preview.pxpressllc.com/api/email/attachments/file','2026-09-02T20:04:00Z',now,origins)).toContain('/api/email/attachments/file');expect(()=>validateAttachmentAccess('http://preview.pxpressllc.com/api/email/attachments/file','2026-09-02T20:04:00Z',now,origins)).toThrow(/safe/);expect(()=>validateAttachmentAccess('https://storage.example/file','2026-09-02T20:04:00Z',now,origins)).toThrow(/proxy/);expect(()=>validateAttachmentAccess('https://preview.pxpressllc.com/api/email/attachments/file','2026-09-02T20:10:00Z',now,origins)).toThrow(/five minutes/)});
  it('calls a send verified only for a complete matching current provider receipt',()=>{const now=new Date('2026-09-02T20:00:00Z'),receipt={idempotencyKey:'key-1',providerMessageId:'message-1',providerThreadId:'thread-1',verifiedAt:'2026-09-02T19:59:00Z'};expect(validateSendReceipt(receipt,'key-1',now)).toBe(receipt);expect(()=>validateSendReceipt({...receipt,idempotencyKey:'other'},'key-1',now)).toThrow(/did not match/);expect(()=>validateSendReceipt({...receipt,providerMessageId:''},'key-1',now)).toThrow(/complete/);expect(()=>validateSendReceipt({...receipt,verifiedAt:'2026-09-02T19:40:00Z'},'key-1',now)).toThrow(/current/)});
  it('enforces exact owner allowlist and redacts logs',()=>{
    expect(safeOwnerMatch('pxpressmedia@gmail.com',['PXPRESSMEDIA@gmail.com'])).toBe(true);
    expect(safeOwnerMatch('other@gmail.com',['pxpressmedia@gmail.com'])).toBe(false);
    expect(redactEmailLog('to pxpressmedia@gmail.com token abcdefghijklmnopqrstuvwxyz123456')).toBe('to [email] token [redacted]');
  });
});
