import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { emailFeatureState,ownerEmailProvider } from './repository';
import type { EmailConnection,EmailMessage,EmailThread,MessageAction } from './types';
import { dedupeThreads } from './domain';
import {ownerEmailCacheScope,ownerEmailMemoryCache} from './memory-cache';
import {useOptionalAuth} from '../../auth';

const disconnected:EmailConnection={connected:false,readEnabled:false,composeEnabled:false,modifyEnabled:false,status:'disconnected'};
export function useOwnerEmail(){
  const user=useOptionalAuth()?.user;
  const provider=useMemo(ownerEmailProvider,[]);
  const features=emailFeatureState();
  const scope=useMemo(()=>ownerEmailCacheScope(user?.id||'signed-out',user?.email||'signed-out'),[user?.email,user?.id]);
  const initialConnection=ownerEmailMemoryCache.connection(scope)?.value||disconnected;
  const initialPage=ownerEmailMemoryCache.list(scope,'','inbox')?.value;
  const [connection,setConnection]=useState<EmailConnection>(initialConnection);
  const [threads,setThreads]=useState<EmailThread[]>(initialPage?.items||[]);
  const [selected,setSelected]=useState<{thread:EmailThread;messages:EmailMessage[]}|null>(null);
  const [nextPageToken,setNextPageToken]=useState<string|undefined>(initialPage?.nextPageToken);
  const [loading,setLoading]=useState(!initialPage),[error,setError]=useState('');
  const [query,setQuery]=useState(''),[label,setLabel]=useState('inbox');
  const requestSequence=useRef(0);
  const load=useCallback(async(reset=true,force=false)=>{
    const pageToken=reset?undefined:nextPageToken;
    const cachedPage=!force?ownerEmailMemoryCache.list(scope,query,label,pageToken):undefined;
    const cachedConnection=!force?ownerEmailMemoryCache.connection(scope):undefined;
    const cacheGeneration=ownerEmailMemoryCache.generation(scope);
    const sequence=++requestSequence.current;
    if(cachedPage&&reset){setThreads(cachedPage.value.items);setNextPageToken(cachedPage.value.nextPageToken)}
    if(cachedConnection)setConnection(cachedConnection.value);
    setLoading(!cachedPage);setError('');
    try{
      if(!features.read){setConnection(disconnected);setThreads([]);setNextPageToken(undefined);setSelected(null);return}
      const status=cachedConnection?.fresh?cachedConnection.value:await provider.connection();
      if(!cachedConnection?.fresh&&!ownerEmailMemoryCache.setConnection(scope,cacheGeneration,status))return;
      if(sequence!==requestSequence.current)return;
      setConnection(status);
      if(!status.connected||!status.readEnabled){setThreads([]);setNextPageToken(undefined);setSelected(null);return}
      const page=await provider.listThreads({query,label,pageToken,pageSize:30});
      if(!ownerEmailMemoryCache.setList(scope,cacheGeneration,query,label,pageToken,page))return;
      if(sequence!==requestSequence.current)return;
      setThreads(current=>dedupeThreads(reset?page.items:[...current,...page.items]));setNextPageToken(page.nextPageToken);
    }catch(reason){if(!cachedPage)setError(reason instanceof Error?reason.message:'Email could not be loaded.');}
    finally{if(sequence===requestSequence.current)setLoading(false)}
  },[features.read,label,nextPageToken,provider,query,scope]);
  useEffect(()=>{const timer=window.setTimeout(()=>void load(true),query?350:0);return()=>window.clearTimeout(timer)},[label,query]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>()=>{requestSequence.current+=1},[]);
  const open=useCallback(async(thread:EmailThread)=>{setError('');const cached=ownerEmailMemoryCache.thread(scope,thread.providerThreadId);if(cached){setSelected(cached.value);if(cached.fresh)return}const generation=ownerEmailMemoryCache.generation(scope);try{const detail=await provider.readThread(thread.providerThreadId);if(!ownerEmailMemoryCache.setThread(scope,generation,thread.providerThreadId,detail))return;setSelected(detail)}catch(reason){if(!cached)setError(reason instanceof Error?reason.message:'This conversation could not be opened.')}},[provider,scope]);
  const modify=useCallback(async(thread:EmailThread,action:MessageAction)=>{setError('');try{await provider.modifyThread(thread.providerThreadId,action,crypto.randomUUID());ownerEmailMemoryCache.invalidateThread(scope,thread.providerThreadId);const leavesCurrentView=(action==='archive'&&label==='inbox')||(action==='restore'&&label==='archive')||(action==='trash'&&label!=='trash')||(action==='untrash'&&label==='trash');if(leavesCurrentView){setThreads(current=>current.filter(item=>item.id!==thread.id));setSelected(null)}else{const patch=action==='star'?{starred:true}:action==='unstar'?{starred:false}:action==='mark_read'?{unread:false}:action==='mark_unread'?{unread:true}:{};setThreads(current=>current.map(item=>item.id===thread.id?{...item,...patch}:item));setSelected(current=>current?.thread.id===thread.id?{...current,thread:{...current.thread,...patch}}:current)}}catch(reason){setError(reason instanceof Error?reason.message:'Email action could not be verified.');throw reason}},[label,provider,scope]);
  return{provider,connection,threads,selected,nextPageToken,loading,error,query,setQuery,label,setLabel,load,open,modify,setSelected};
}
