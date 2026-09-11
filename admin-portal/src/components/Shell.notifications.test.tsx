import { render,screen,waitFor,within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach,describe,expect,it,vi } from 'vitest';
import { AuthProvider } from '../auth';
import { notificationStorageKey } from '../features/owner-notifications/local-repository';
import { Shell } from './Shell';

vi.mock('../auth',()=>({
  AuthProvider:({children}:{children:React.ReactNode})=>children,
  useAuth:()=>({user:{email:'pxpressmedia@gmail.com'},signOut:vi.fn()}),
}));
vi.mock('../hooks',()=>({
  useNotificationRequests:()=>({data:[],provenance:'explicit_demo',loading:true,error:'',reload:vi.fn()}),
  useEvents:()=>({data:[],loading:false,error:'',reload:vi.fn()}),
}));

describe('owner navigation unread indicators',()=>{
  beforeEach(()=>{
    const values=new Map<string,string>();
    Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key),clear:()=>values.clear(),key:(index:number)=>[...values.keys()][index]||null,get length(){return values.size}}});
  });
  it('shows an accessible gold unread indicator in desktop Notifications and mobile More',async()=>{
    window.localStorage.setItem(notificationStorageKey,JSON.stringify({version:2,initialized:true,records:{'new:req-1048':{notification:{id:'new:req-1048',requestId:'req-1048',kind:'new_request',priority:2,title:'New ride request',detail:'Ready for review.',at:'2026-08-29T13:18:00Z',timeBasis:'request_received_fallback'},active:true,read:false,bannerDismissed:false,firstSeenAt:'2026-08-29T13:18:00Z',lastSeenAt:'2026-08-29T13:18:00Z'}}}));
    render(<MemoryRouter><AuthProvider><Shell><p>Content</p></Shell></AuthProvider></MemoryRouter>);
    await waitFor(()=>expect(screen.getByRole('link',{name:'Notifications, 1 unread notification'})).toBeInTheDocument());
    const mobile=screen.getAllByRole('navigation',{name:'Owner navigation'})[1];
    expect(within(mobile).getByRole('link',{name:'More, 1 unread notification'})).toBeInTheDocument();
    expect(document.querySelectorAll('.nav-unread-badge')).toHaveLength(2);
  });
});
