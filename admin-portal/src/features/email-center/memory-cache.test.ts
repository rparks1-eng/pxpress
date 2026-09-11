import {beforeEach,describe,expect,it} from 'vitest';
import {ownerEmailCacheScope,ownerEmailMemoryCache} from './memory-cache';
import type {EmailConnection,EmailPage,EmailThread} from './types';

const scope=ownerEmailCacheScope('owner-1','pxpressmedia@gmail.com');
const connected:EmailConnection={connected:true,accountEmail:'pxpressmedia@gmail.com',readEnabled:true,composeEnabled:true,modifyEnabled:true,status:'active'};
const thread:EmailThread={id:'t1',providerThreadId:'t1',historyId:'h1',subject:'Ride',participants:[],snippet:'Hello',lastMessageAt:'2026-09-07T12:00:00Z',unread:true,starred:false,labels:['inbox'],messageCount:1,matchedRequestIds:[]};
const page:EmailPage={items:[thread],nextPageToken:'next'};

describe('owner email memory cache',()=>{
  beforeEach(()=>ownerEmailMemoryCache.clearAll());
  it('returns fresh then stale session-only results before expiration',()=>{
    const generation=ownerEmailMemoryCache.generation(scope);
    ownerEmailMemoryCache.setConnection(scope,generation,connected,1_000);
    ownerEmailMemoryCache.setList(scope,generation,'','inbox',undefined,page,1_000);
    expect(ownerEmailMemoryCache.connection(scope,60_999)).toEqual({value:connected,fresh:true});
    expect(ownerEmailMemoryCache.connection(scope,61_000)).toEqual({value:connected,fresh:false});
    expect(ownerEmailMemoryCache.connection(scope,121_000)).toBeUndefined();
    expect(ownerEmailMemoryCache.list(scope,'','inbox',undefined,45_999)?.fresh).toBe(true);
    expect(ownerEmailMemoryCache.list(scope,'','inbox',undefined,46_000)?.fresh).toBe(false);
    expect(ownerEmailMemoryCache.list(scope,'','inbox',undefined,301_000)).toBeUndefined();
  });
  it('isolates owner/provider scopes and rejects stale writes after clearing',()=>{
    const other=ownerEmailCacheScope('owner-2','pxpressmedia@gmail.com');
    const generation=ownerEmailMemoryCache.generation(scope);
    ownerEmailMemoryCache.clearScope(scope);
    expect(ownerEmailMemoryCache.setList(scope,generation,'','inbox',undefined,page,1_000)).toBe(false);
    expect(ownerEmailMemoryCache.list(other,'','inbox',undefined,1_001)).toBeUndefined();
  });
  it('invalidates mutations and bounds least-recently-used thread data',()=>{
    const generation=ownerEmailMemoryCache.generation(scope);
    ownerEmailMemoryCache.setList(scope,generation,'','inbox',undefined,page,1_000);
    for(let index=0;index<25;index++)ownerEmailMemoryCache.setThread(scope,generation,`t${index}`,{thread:{...thread,id:`t${index}`,providerThreadId:`t${index}`},messages:[]},1_000+index);
    expect(ownerEmailMemoryCache.sizes(scope).threads).toBe(20);
    ownerEmailMemoryCache.invalidateThread(scope,'t24');
    expect(ownerEmailMemoryCache.sizes(scope)).toEqual({lists:0,threads:19});
  });
});
