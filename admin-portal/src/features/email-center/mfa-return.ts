const SECTION_RETURNS=new Set(['/email','/notifications','/calendar']);
const REQUEST_RETURN=/^\/requests\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function safeOwnerMfaReturnPath(value:string|null){
  return value!==null&&(SECTION_RETURNS.has(value)||REQUEST_RETURN.test(value)) ? value : '/';
}
