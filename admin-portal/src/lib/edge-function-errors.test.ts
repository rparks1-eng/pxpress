import { describe, expect, it } from 'vitest';
import { RouteEstimateError, toRouteEstimateError } from './edge-function-errors';

const httpError=(body:Record<string,unknown>)=>({
  name:'FunctionsHttpError',
  message:'Edge Function returned a non-2xx status code',
  context:new Response(JSON.stringify(body),{status:409,headers:{'content-type':'application/json'}}),
});

describe('route estimate function errors',()=>{
  it('reads an approved function code and returns a bounded owner message',async()=>{
    const error=await toRouteEstimateError(httpError({message:'Route mileage could not be calculated.',code:'INVALID_RATE_LIMIT_INPUT'}));
    expect(error).toBeInstanceOf(RouteEstimateError);
    expect(error.code).toBe('INVALID_RATE_LIMIT_INPUT');
    expect(error.message).toBe('Mileage limit protection needs configuration. [INVALID_RATE_LIMIT_INPUT]');
  });

  it('never exposes an unapproved provider or secret-bearing response',async()=>{
    const error=await toRouteEstimateError(httpError({message:'secret=do-not-show',code:'SECRET_PROVIDER_DETAIL'}));
    expect(error.code).toBe('ROUTE_ESTIMATE_FAILED');
    expect(error.message).toBe('Mileage could not be calculated. [ROUTE_ESTIMATE_FAILED]');
    expect(error.message).not.toContain('do-not-show');
    expect(error.message).not.toContain('SECRET_PROVIDER_DETAIL');
  });

  it('maps early function responses that do not include a code',async()=>{
    const error=await toRouteEstimateError(httpError({message:'Owner authentication required.'}));
    expect(error.code).toBe('OWNER_AUTHENTICATION_REQUIRED');
    expect(error.message).toContain('Sign in to the owner portal again');
  });

  it('maps approved Google status codes without returning a provider body',async()=>{
    const error=await toRouteEstimateError(httpError({message:'arbitrary provider response',code:'GOOGLE_ROUTES_403'}));
    expect(error.code).toBe('GOOGLE_ROUTES_403');
    expect(error.message).toBe('Google Routes authorization needs attention. [GOOGLE_ROUTES_403]');
    expect(error.message).not.toContain('arbitrary provider response');
  });

  it('distinguishes safe provider parsing and leg-shape failures without exposing payloads',async()=>{
    const unreadable=await toRouteEstimateError(httpError({message:'Route mileage could not be calculated.',code:'GOOGLE_ROUTES_RESPONSE_JSON_INVALID',stage:'provider_parse'}));
    const count=await toRouteEstimateError(httpError({message:'Route mileage could not be calculated.',code:'GOOGLE_ROUTES_LEG_COUNT_MISMATCH',stage:'leg_validation'}));
    const leg=await toRouteEstimateError(httpError({message:'Route mileage could not be calculated.',code:'GOOGLE_ROUTES_LEG_DATA_INVALID',stage:'leg_validation'}));
    expect(unreadable.message).toContain('unreadable mileage response');
    expect(count.message).toContain('unexpected number of route legs');
    expect(leg.message).toContain('incomplete data for a route leg');
  });

  it('distinguishes a browser network failure from an HTTP failure',async()=>{
    const error=await toRouteEstimateError({name:'FunctionsFetchError',message:'Failed to send a request to the Edge Function'});
    expect(error.code).toBe('ROUTE_NETWORK_UNAVAILABLE');
    expect(error.message).not.toContain('Edge Function');
  });

  it('recognizes gateway JWT rejection before a handler diagnostic exists',async()=>{
    const error=await toRouteEstimateError({context:Response.json({message:'Invalid JWT'},{status:401})});
    expect(error.code).toBe('OWNER_AUTHENTICATION_REQUIRED');
    expect(error.message).toContain('Sign in');
    const forbidden=await toRouteEstimateError(null,Response.json({message:'Forbidden'},{status:403}));
    expect(forbidden.code).toBe('OWNER_ACCESS_DENIED');
  });

  it('explains disabled, missing-key, and incomplete round-trip states with a manual path',async()=>{
    const disabled=await toRouteEstimateError(httpError({message:'Route mileage could not be calculated.',code:'GOOGLE_ROUTE_ESTIMATES_DISABLED'}));
    const missingKey=await toRouteEstimateError(httpError({message:'Route mileage could not be calculated.',code:'GOOGLE_MAPS_CONFIGURATION_MISSING'}));
    const missingReturn=await toRouteEstimateError(httpError({message:'Route mileage could not be calculated.',code:'ROUTE_RETURN_ADDRESS_MISSING'}));
    expect(disabled.message).toContain('Use manual mileage below');
    expect(missingKey.message).toContain('Google Routes configuration');
    expect(missingReturn.message).toContain('round-trip return location');
  });
});
