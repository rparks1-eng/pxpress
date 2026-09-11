export const pxpressEmailTemplateFixture=`<!doctype html>
<html>
  <head>
    <style>
      body{margin:0;background:#050505;color:#f5f0e7;font-family:Arial,sans-serif}
      .shell{width:100%;background:#050505;padding:28px 12px}
      .letter{width:600px;max-width:100%;margin:0 auto;border:1px solid #7f6128;background:#0a0a0a}
      .brand{padding:24px;text-align:center;border-bottom:1px solid #342910}
      .brand img{width:210px;height:auto}
      .copy{padding:34px 38px;font-size:16px;line-height:1.65}
      .copy h1{margin:0 0 18px;color:#d1aa5a;font-size:30px;font-weight:500}
      .cta{display:inline-block;background:#c9a35c;color:#090806;padding:13px 22px;text-decoration:none;font-weight:bold}
      @media(max-width:620px){.copy{padding:26px 20px}.copy h1{font-size:25px}}
    </style>
  </head>
  <body>
    <table class="shell" role="presentation" cellpadding="0" cellspacing="0"><tr><td>
      <table class="letter" role="presentation" cellpadding="0" cellspacing="0">
        <tr><td class="brand"><img src="https://preview.pxpressllc.com/email-assets/pxpress-logo.png" width="210" alt="Pxpress"></td></tr>
        <tr><td class="copy"><h1>We received your ride request.</h1><p>Your request is in review. We will send your quote and next steps once the details are confirmed.</p><p><a class="cta" href="https://preview.pxpressllc.com/request-a-ride">View your request</a></p></td></tr>
      </table>
    </td></tr></table>
  </body>
</html>`;
