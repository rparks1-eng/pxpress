import {supabase} from '../../lib/supabase';
import {expenseCategories,type ExpenseDraft,type ExpenseTransaction,type MerchantRule} from './types';

export type SavedExpense=ExpenseTransaction&{version:number;archivedAt:string|null;ownerId:string;receiptId?:string};
const selection='*,expense_receipts(*)';
const bucket='pxpress-expense-receipts';
const db=()=>{if(!supabase)throw new Error('Expense storage is unavailable. Nothing has been saved.');return supabase};
const fail=(error:{code?:string}|null)=>{
 if(!error)return;
 if(['42P01','PGRST205','42703'].includes(error.code||''))throw new Error('Expense storage is not enabled yet. Nothing has been saved.');
 if(['42501','PGRST301'].includes(error.code||''))throw new Error('Please sign in again to access expenses.');
 throw new Error('Expenses could not be saved or loaded. Please try again.');
};
type Row=Record<string,any>;
export function mapExpense(row:Row):SavedExpense{
 const receipts=(row.expense_receipts||[]).filter((r:Row)=>r.storage_state==='stored').sort((a:Row,b:Row)=>String(b.created_at).localeCompare(String(a.created_at)));
 const receipt=receipts[0];
 return {id:row.id,ownerId:row.owner_id,occurredOn:row.occurred_on,merchant:row.merchant,description:row.description||'',amount:Number(row.amount),currency:'USD',category:row.category,classification:row.classification,businessUsePercent:Number(row.business_use_percent),reviewState:row.review_state,source:row.source,paymentMethod:row.payment_method||'',notes:row.notes||'',createdAt:row.created_at,updatedAt:row.updated_at,version:row.version,archivedAt:row.archived_at,receiptId:receipt?.id,receipt:receipt?{state:'stored',fileName:receipt.file_name,mimeType:receipt.mime_type,byteSize:receipt.byte_size,storagePath:receipt.storage_path}:{state:'missing'}};
}
export function expensePayload(draft:ExpenseDraft){
 const date=new Date(draft.occurredOn+'T12:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.occurredOn)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==draft.occurredOn)throw new Error('Choose a valid expense date.');
 if(!draft.merchant.trim()||draft.merchant.trim().length>200)throw new Error('Enter a merchant name under 200 characters.');
 if(!Number.isFinite(draft.amount)||draft.amount<=0||draft.amount>9999999.99)throw new Error('Enter a valid amount greater than zero.');
 if(!expenseCategories.includes(draft.category))throw new Error('Choose an expense category.');
 if(!['business','personal','mixed'].includes(draft.classification)||!Number.isFinite(draft.businessUsePercent)||draft.businessUsePercent<0||draft.businessUsePercent>100)throw new Error('Choose a valid business-use percentage.');
 if((draft.description||'').length>500||(draft.notes||'').length>2000||(draft.paymentMethod||'').length>120)throw new Error('Shorten the description, note, or payment method.');
 return {occurred_on:draft.occurredOn,merchant:draft.merchant.trim(),description:draft.description?.trim()||null,amount:Math.round(draft.amount*100)/100,currency:'USD',category:draft.category,classification:draft.classification,business_use_percent:draft.classification==='business'?100:draft.classification==='personal'?0:draft.businessUsePercent,payment_method:draft.paymentMethod?.trim()||null,notes:draft.notes?.trim()||null};
}
export async function listExpenses(month:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Choose a valid month.');
 const start=month+'-01',end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString().slice(0,10);
 const {data,error}=await db().from('expense_transactions').select(selection).gte('occurred_on',start).lt('occurred_on',end).order('occurred_on',{ascending:false}).order('id').limit(501);
 fail(error);if(!data)throw new Error('Expenses could not be loaded.');
 if(data.length>500)throw new Error('This month exceeds the 500-entry view limit. Request a full ledger export before using these totals.');
 return data.map(mapExpense);
}
export async function createExpense(id:string,draft:ExpenseDraft){
 const payload=expensePayload(draft);
 const {data,error}=await db().from('expense_transactions').insert({id,...payload,source:'manual',review_state:'needs_review'}).select(selection).single();
 if(error){
  // Retrying the same form never creates a second expense after an uncertain response.
  const existing=await db().from('expense_transactions').select(selection).eq('id',id).maybeSingle();
  if(existing.data&&Object.entries(payload).every(([key,value])=>key==='amount'||key==='business_use_percent'?Number(existing.data[key])===value:existing.data[key]===value))return mapExpense(existing.data);
  fail(error);
 }
 if(!data)throw new Error('Save could not be confirmed. Please retry without closing this form.');
 return mapExpense(data);
}
export async function updateExpense(expense:SavedExpense,draft:ExpenseDraft,reviewState=expense.reviewState,archive=!!expense.archivedAt){
 const {currency:_,...payload}=expensePayload(draft);
 if(reviewState==='reviewed'&&draft.category==='needs_review')throw new Error('Choose a category before marking reviewed.');
 const {data,error}=await db().from('expense_transactions').update({...payload,review_state:reviewState,archived_at:archive?(expense.archivedAt||new Date().toISOString()):null}).eq('id',expense.id).eq('version',expense.version).select(selection).maybeSingle();
 fail(error);if(!data)throw new Error('This expense changed on another device. Close this form, refresh, and try again.');return mapExpense(data);
}
export async function listMerchantRules():Promise<MerchantRule[]>{
 const {data,error}=await db().from('expense_merchant_rules').select('*').order('created_at',{ascending:false}).limit(200);fail(error);
 return (data||[]).map(r=>({id:r.id,merchantPattern:r.merchant_pattern,matchType:r.match_type,category:r.category,classification:r.classification,businessUsePercent:Number(r.business_use_percent),enabled:r.enabled}));
}
export async function validateReceipt(file:File){
 if(!file.size||file.size>10*1024*1024)throw new Error('Choose a receipt under 10 MB.');
 const b=new Uint8Array(await file.slice(0,16).arrayBuffer()),ascii=String.fromCharCode(...b);
 const valid=(file.type==='image/jpeg'&&b[0]===255&&b[1]===216&&b[2]===255)||(file.type==='image/png'&&b[0]===137&&ascii.slice(1,4)==='PNG')||(file.type==='application/pdf'&&ascii.startsWith('%PDF-'))||(file.type==='image/webp'&&ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP')||(['image/heic','image/heif'].includes(file.type)&&ascii.slice(4,8)==='ftyp'&&/heic|heix|hevc|mif1/.test(ascii.slice(8)));
 if(!valid)throw new Error('Use a JPG, PNG, WebP, HEIC, or PDF receipt.');
}
export async function attachExpenseReceipt(expense:SavedExpense,file:File){
 await validateReceipt(file);
 const path=expense.ownerId+'/'+expense.id+'/'+crypto.randomUUID();
 const store=db().storage.from(bucket);
 const upload=await store.upload(path,file,{contentType:file.type,upsert:false,cacheControl:'0'});
 if(upload.error)throw new Error('Receipt upload failed. Your expense is saved; try the receipt again.');
 const {error}=await db().from('expense_receipts').insert({expense_transaction_id:expense.id,file_name:file.name.slice(0,240),mime_type:file.type,byte_size:file.size,storage_state:'stored',storage_path:path});
 if(error){await store.remove([path]);throw new Error('The receipt could not be attached. Your expense is still saved.');}
}
export async function downloadExpenseReceipt(expense:SavedExpense){
 if(!expense.receipt.storagePath)throw new Error('No receipt is attached.');
 const {data,error}=await db().storage.from(bucket).download(expense.receipt.storagePath);
 if(error||!data)throw new Error('Receipt could not be opened. Please try again.');
 return data;
}
