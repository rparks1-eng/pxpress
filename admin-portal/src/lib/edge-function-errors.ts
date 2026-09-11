const routeCodeMessages:Record<string,string>={
  ROUTE_REQUEST_NOT_FOUND:'This ride request could not be found.',
  GOOGLE_ROUTE_ESTIMATES_DISABLED:'Automatic mileage is not connected yet. Use manual mileage below.',
  GOOGLE_MAPS_CONFIGURATION_MISSING:'Automatic mileage needs its Google Routes configuration. Use manual mileage below.',
  SERVER_CONFIGURATION_MISSING:'Automatic mileage needs its private server configuration. Use manual mileage below.',
  ROUTE_ADDRESS_MISSING:'Add both a pickup and destination before calculating mileage.',
  ROUTE_RETURN_ADDRESS_MISSING:'Add the round-trip return location before calculating mileage.',
  INVALID_RATE_LIMIT_INPUT:'Mileage limit protection needs configuration.',
  ROUTE_ESTIMATE_RECEIPT_FAILED:'The mileage result could not be saved.',
  GOOGLE_ROUTES_READBACK_INVALID:'Google Routes returned an incomplete mileage result.',
  GOOGLE_ROUTES_RESPONSE_JSON_INVALID:'Google Routes returned an unreadable mileage response.',
  GOOGLE_ROUTES_LEG_COUNT_MISMATCH:'Google Routes returned an unexpected number of route legs.',
  GOOGLE_ROUTES_LEG_DATA_INVALID:'Google Routes returned incomplete data for a route leg.',
  GOOGLE_ROUTES_ROUTE_TOTAL_INVALID:'Google Routes returned an invalid overall route total.',
  GOOGLE_INTEGRATION_FAILED:'Mileage could not be calculated.',
  DATABASE_REQUEST_FAILED:'Mileage could not be calculated because the data service is unavailable.',
  ORIGIN_NOT_ALLOWED:'This owner portal address is not approved for mileage calculations.',
  OWNER_AUTHENTICATION_REQUIRED:'Sign in to the owner portal again before calculating mileage.',
  OWNER_AAL2_REQUIRED:'Verify your identity with your authenticator before calculating mileage.',
  OWNER_ACCESS_DENIED:'Your signed-in account could not access mileage calculations.',
  ROUTE_REQUEST_INVALID:'This ride request is not valid for mileage calculation.',
  ROUTE_RATE_LIMITED:'The mileage calculation limit was reached. Try again later.',
  GOOGLE_ROUTES_MONTHLY_CAP_REACHED:'The monthly mileage lookup allowance has been reached.',
  ROUTE_SERVICE_UNAVAILABLE:'Mileage is temporarily unavailable.',
  ROUTE_NETWORK_UNAVAILABLE:'The mileage service could not be reached. Check the connection and try again.',
  ROUTE_RELAY_UNAVAILABLE:'The mileage service is temporarily unavailable.',
  ROUTE_ESTIMATE_FAILED:'Mileage could not be calculated.',
};

const messageCodes:Record<string,string>={
  'Origin not allowed.':'ORIGIN_NOT_ALLOWED',
  'Owner authentication required.':'OWNER_AUTHENTICATION_REQUIRED',
  'A valid ride request is required.':'ROUTE_REQUEST_INVALID',
  'Route calculation limit reached. Try again later.':'ROUTE_RATE_LIMITED',
  'Route estimates are temporarily unavailable.':'ROUTE_SERVICE_UNAVAILABLE',
  'Route mileage could not be calculated.':'ROUTE_ESTIMATE_FAILED',
};

const isRecord=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);

const approvedCode=(value:unknown):string|undefined=>{
  if(typeof value!=='string')return undefined;
  if(value in routeCodeMessages)return value;
  return /^GOOGLE_ROUTES_(400|401|403|404|408|409|422|429|500|502|503|504)$/.test(value)?value:undefined;
};

const providerMessage=(code:string):string=>{
  const status=Number(code.slice('GOOGLE_ROUTES_'.length));
  if(status===400||status===404||status===422)return 'Google Routes could not resolve one of the ride addresses.';
  if(status===401||status===403)return 'Google Routes authorization needs attention.';
  if(status===408||status===429)return 'Google Routes is busy or rate-limited. Try again later.';
  return 'Google Routes is temporarily unavailable.';
};

const responseBody=async(response:unknown):Promise<Record<string,unknown>|null>=>{
  if(!(response instanceof Response))return null;
  try{
    const raw=await response.clone().text();
    if(!raw||raw.length>2048)return null;
    const parsed:unknown=JSON.parse(raw);
    return isRecord(parsed)?parsed:null;
  }catch{return null}
};

export class RouteEstimateError extends Error{
  readonly code:string;
  constructor(code:string,message:string){super(`${message} [${code}]`);this.name='RouteEstimateError';this.code=code}
}

export async function toRouteEstimateError(error:unknown,response?:unknown):Promise<RouteEstimateError>{
  const context=isRecord(error)&&'context' in error?error.context:undefined;
  const actualResponse=response??context;
  const body=await responseBody(actualResponse);
  const bodyCode=approvedCode(body?.code);
  const bodyMessage=typeof body?.message==='string'?body.message:'';
  let code=bodyCode??messageCodes[bodyMessage];
  // Gateway JWT rejections happen before the handler and have no custom code.
  if(!code&&actualResponse instanceof Response&&actualResponse.status===401)code='OWNER_AUTHENTICATION_REQUIRED';
  if(!code&&actualResponse instanceof Response&&actualResponse.status===403)code='OWNER_ACCESS_DENIED';
  const errorName=isRecord(error)&&typeof error.name==='string'?error.name:'';
  if(!code&&errorName==='FunctionsFetchError')code='ROUTE_NETWORK_UNAVAILABLE';
  if(!code&&errorName==='FunctionsRelayError')code='ROUTE_RELAY_UNAVAILABLE';
  code=code??'ROUTE_ESTIMATE_FAILED';
  const message=routeCodeMessages[code]??(code.startsWith('GOOGLE_ROUTES_')?providerMessage(code):routeCodeMessages.ROUTE_ESTIMATE_FAILED);
  return new RouteEstimateError(code,message);
}
