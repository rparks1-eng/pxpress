import type {EmailConnection,EmailMessage,EmailPage,EmailThread} from './types';

const LIST_FRESH_MS=45_000,LIST_STALE_MS=5*60_000;
const THREAD_FRESH_MS=60_000,THREAD_STALE_MS=5*60_000;
const CONNECTION_FRESH_MS=60_000,CONNECTION_STALE_MS=2*60_000;
const MAX_LISTS=8,MAX_THREADS=20;
type Entry<T>={value:T;storedAt:number};
export type CacheHit<T>={value:T;fresh:boolean};
type ScopeStore={generation:number;connection?:Entry<EmailConnection>;lists:Map<string,Entry<EmailPage>>;threads:Map<string,Entry<{thread:EmailThread;messages:EmailMessage[]}>>};
const stores=new Map<string,ScopeStore>();
const storeFor=(scope:string)=>{let store=stores.get(scope);if(!store){store={generation:0,lists:new Map(),threads:new Map()};stores.set(scope,store)}return store};
const read=<T>(entry:Entry<T>|undefined,freshMs:number,staleMs:number,now:number):CacheHit<T>|undefined=>!entry||now-entry.storedAt>=staleMs?undefined:{value:entry.value,fresh:now-entry.storedAt<freshMs};
const touch=<T>(map:Map<string,Entry<T>>,key:string,entry:Entry<T>)=>{map.delete(key);map.set(key,entry)};
const trim=<T>(map:Map<string,Entry<T>>,limit:number)=>{while(map.size>limit)map.delete(map.keys().next().value!)};
const listKey=(query:string,label:string,pageToken?:string)=>`${label}\n${query}\n${pageToken||''}`;

export const ownerEmailCacheScope=(ownerId:string,email:string,provider='gmail')=>`${provider}:${ownerId}:${email.trim().toLowerCase()}`;
export const ownerEmailMemoryCache={
  generation(scope:string){return storeFor(scope).generation},
  connection(scope:string,now=Date.now()){return read(storeFor(scope).connection,CONNECTION_FRESH_MS,CONNECTION_STALE_MS,now)},
  setConnection(scope:string,generation:number,value:EmailConnection,now=Date.now()){const store=storeFor(scope);if(store.generation!==generation)return false;store.connection={value,storedAt:now};return true},
  list(scope:string,query:string,label:string,pageToken?:string,now=Date.now()){const store=storeFor(scope),key=listKey(query,label,pageToken),entry=store.lists.get(key);if(entry)touch(store.lists,key,entry);return read(entry,LIST_FRESH_MS,LIST_STALE_MS,now)},
  setList(scope:string,generation:number,query:string,label:string,pageToken:string|undefined,value:EmailPage,now=Date.now()){const store=storeFor(scope);if(store.generation!==generation)return false;touch(store.lists,listKey(query,label,pageToken),{value,storedAt:now});trim(store.lists,MAX_LISTS);return true},
  thread(scope:string,providerThreadId:string,now=Date.now()){const store=storeFor(scope),entry=store.threads.get(providerThreadId);if(entry)touch(store.threads,providerThreadId,entry);return read(entry,THREAD_FRESH_MS,THREAD_STALE_MS,now)},
  setThread(scope:string,generation:number,providerThreadId:string,value:{thread:EmailThread;messages:EmailMessage[]},now=Date.now()){const store=storeFor(scope);if(store.generation!==generation)return false;touch(store.threads,providerThreadId,{value,storedAt:now});trim(store.threads,MAX_THREADS);return true},
  invalidateThread(scope:string,providerThreadId:string){const store=storeFor(scope);store.threads.delete(providerThreadId);store.lists.clear()},
  clearScope(scope:string){const store=storeFor(scope);store.generation+=1;store.connection=undefined;store.lists.clear();store.threads.clear()},
  clearAll(){for(const scope of stores.keys())this.clearScope(scope)},
  sizes(scope:string){const store=storeFor(scope);return{lists:store.lists.size,threads:store.threads.size}},
};
