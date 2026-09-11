/** Preserve the authored black Pxpress palette.
 * Does not alter recipients, links, wording, or delivery logic.
 */
export function withAdaptiveEmailAppearance(html:string):string{
 const authored=html.replace(/(name="(?:supported-color-schemes|color-scheme)" content=")[^"]*(")/g,'$1dark$2');
 const css=`<style>:root{color-scheme:dark;supported-color-schemes:dark}
 html,body{background-color:#000000!important;color:#f3f0e8}
 [data-ogsc] [bgcolor="#000000"]{background-color:#000000!important}
 </style>`;
 return authored.replace('</head>',css+'</head>');
}
