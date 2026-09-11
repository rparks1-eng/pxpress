import './public-finder-price.css';
import {useEffect,useState} from 'react';
import {readPublicFinderState,preparePublicFinderContext,savePublicFinderPrice,type PublicFinderState} from './public-finder-repository';
export function PublicFinderPricePanel({requestId,pickupAddress,subtotalMinor}:{requestId:string;pickupAddress:string;subtotalMinor:number}){
 const [state,setState]=useState<PublicFinderState|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[policyId,setPolicy]=useState(''),[date,setDate]=useState(''),[route,setRoute]=useState(''),[boarding,setBoarding]=useState(''),[confirmed,setConfirmed]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{let current=true;readPublicFinderState(requestId).then(s=>{if(current)setState(s)}).catch(e=>{if(current)setError(e.message)});return()=>{current=false}},[requestId]);
 const policy=state?.policies.find(p=>p.id===policyId);
 async function refresh(){setBusy(true);setError('');try{setState(await readPublicFinderState(requestId));}catch(e){setError(e instanceof Error?e.message:'Review unavailable.')}finally{setBusy(false)}}
 async function prepare(){if(!state?.job||!policy)return;setBusy(true);setError('');try{await preparePublicFinderContext(state.job.id,{requestRevision:state.job.requestRevision,policyId:policy.id,dateBasis:policy.dateBasis,firstUseAddress:pickupAddress,applicableDate:date,treatment:'standard',wholeRouteOhio:true,routeEvidence:route,firstUseEvidence:boarding});setState(await readPublicFinderState(requestId));setNotice('Itinerary review saved. Waiting for the lookup worker.');}catch(e){setError(e instanceof Error?e.message:'Review was not saved.')}finally{setBusy(false)}}
 async function save(){if(!state?.job)return;setBusy(true);setError('');try{const saved=await savePublicFinderPrice(state.job.id,subtotalMinor);const readback=await readPublicFinderState(requestId);if(!readback.draft?.current||readback.draft.id!==saved.id)throw Error('Saved draft is no longer current. Refresh the request.');setState(readback);setNotice('Price draft saved. Customer delivery remains held.');}catch(e){setError(e instanceof Error?e.message:'Draft was not saved.')}finally{setBusy(false)}}
 const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
 return <section className="public-finder-price" aria-label="Public Finder price review"><details><summary>Public Finder price review</summary>
 {!state?<p>{error||'Loading reviewed tax evidence…'}</p>:!state.connected?<p>Public Finder pricing is not connected in this environment.</p>:<>
 <p>{state.job?`Lookup: ${state.job.status.replaceAll('_',' ')}.`:'No lookup job is attached.'} {!state.dispatchEnabled||!state.consumerEnabled?'Automatic lookup is paused.':''}</p>
 {state.policies.length===0?<p>A sourcing and tax-date policy must be approved before a lookup can advance.</p>:state.job?.status==='held_policy'?<fieldset disabled={busy}><legend>Review this one-way ride</legend>
 <label>Approved policy<select value={policyId} onChange={e=>setPolicy(e.target.value)}><option value="">Choose a policy</option>{state.policies.map(p=><option key={p.id} value={p.id}>{p.id}</option>)}</select></label>
 {policy&&<p>{policy.dateBasis} · {policy.sourcingSource}</p>}
 <label>Applicable tax date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
 <label>Whole-route evidence<textarea value={route} onChange={e=>setRoute(e.target.value)} maxLength={2000}/></label>
 <label>First passenger boarding evidence<textarea value={boarding} onChange={e=>setBoarding(e.target.value)} maxLength={2000}/></label>
 <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed the entire route as wholly Ohio and standard taxable transportation, with first boarding at {pickupAddress}.</label>
 <button type="button" onClick={prepare} disabled={!policy||!date||!route.trim()||!boarding.trim()||!confirmed}>Save itinerary review</button></fieldset>:null}
 {state.job?.evidence&&<div className="finder-evidence" aria-label="Exact Finder evidence"><p><strong>Matched address</strong><span>{state.job.evidence.matchedAddress}</span></p><p><strong>Effective date</strong><span>{state.job.evidence.applicableDate}</span></p><p><strong>Jurisdiction and rate</strong><span>{state.job.evidence.jurisdiction} · {(state.job.evidence.rateBasisPoints/100).toFixed(2)}%</span></p><p><strong>Observed</strong><span>{new Date(state.job.evidence.observedAt).toLocaleString()}</span></p><a href={state.job.evidence.sourceUrl} target="_blank" rel="noreferrer">Open Ohio Finder source</a></div>}
 <button type="button" onClick={save} disabled={busy||!state.job?.pricingReady||!Number.isSafeInteger(subtotalMinor)||subtotalMinor<=0}>Save reviewed price draft</button>
 {state.draft&&<p>{state.draft.current?'Saved':'Outdated'} draft: service {money(state.draft.serviceSubtotalMinor)} + tax {money(state.draft.taxMinor)} = {money(state.draft.totalMinor)}.</p>}
 <p>This draft preserves public website evidence. It does not approve a payment or customer delivery.</p><button type="button" onClick={refresh} disabled={busy}>Refresh tax review</button>
 </>}{error&&state&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}</details></section>
}
