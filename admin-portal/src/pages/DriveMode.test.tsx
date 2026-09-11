import { fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { beforeEach,describe,expect,it,vi } from 'vitest';
import type { RideRequest } from '../types';

const mocks=vi.hoisted(()=>({completePaidRide:vi.fn(),transitionRequest:vi.fn(),reload:vi.fn(),request:null as RideRequest|null}));
const ride:RideRequest={id:'ride-1',requestNumber:'PXR-1',status:'confirmed',version:3,createdAt:'2026-09-01T12:00:00Z',customerId:'guest-1',customerName:'Jordan Ellis',email:'jordan@example.com',phone:'2165550100',service:'airport',tripType:'One way',pickupAddress:'100 Main St, Cleveland, OH',destinationAddress:'Cleveland Hopkins Airport',pickupDate:'2026-09-03',pickupTime:'13:45',passengers:2,carryons:1,checkedBags:1,hasOversizedItems:false,customerNotes:'Text on arrival.',cachedRouteMiles:32.4,pricingStatus:'calculated',paymentStatus:'paid'};
vi.mock('../hooks',()=>({useRequests:()=>({data:mocks.request?[mocks.request]:[],loading:false,error:'',reload:mocks.reload})}));
vi.mock('../lib/repository',()=>({completePaidRide:mocks.completePaidRide,transitionRequest:mocks.transitionRequest}));
import { DriveMode } from './DriveMode';

function installStorage(failWrites=false){const values=new Map<string,string>();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{if(failWrites)throw new Error('blocked');values.set(key,value)},removeItem:(key:string)=>{if(failWrites)throw new Error('blocked');values.delete(key)},clear:()=>values.clear(),key:(index:number)=>[...values.keys()][index]??null,get length(){return values.size}} satisfies Storage})}
function setup(){return render(<MemoryRouter initialEntries={['/drive/ride-1']}><Routes><Route path="/drive/:id" element={<DriveMode/>}/><Route path="/" element={<h1>Owner home</h1>}/></Routes></MemoryRouter>)}

describe('Drive Mode owner workflow',()=>{
 beforeEach(()=>{vi.restoreAllMocks();installStorage();mocks.request={...ride};mocks.completePaidRide.mockReset().mockResolvedValue({rideRequestId:'ride-1',status:'completed',presentation:'day',duplicate:false,effectId:'effect-1'});mocks.transitionRequest.mockReset().mockResolvedValue(undefined);mocks.reload.mockReset();vi.spyOn(window,'confirm').mockReturnValue(true);vi.spyOn(window,'open').mockReturnValue(null)});
 it('returns Home and keeps Ride details inside Drive Mode',async()=>{
  setup();
  const home=await screen.findByRole('link',{name:/Back to Home/});
  expect(home).toHaveAttribute('href','/');
  fireEvent.click(screen.getByRole('button',{name:'Ride details'}));
  expect(screen.getByRole('dialog',{name:'Ride details'})).toHaveTextContent('Jordan Ellis');
  expect(screen.getByRole('dialog')).toHaveTextContent('1:45 PM');
  expect(screen.queryByRole('link',{name:/Request details/i})).not.toBeInTheDocument();
  fireEvent.keyDown(document,{key:'Escape'});
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(home);
  expect(screen.getByRole('heading',{name:'Owner home'})).toBeInTheDocument();
 });

 it('renders a decorative route line and verified place hierarchy without a fake control',async()=>{
  mocks.request={...ride,airport:'CLE',destinationAddress:'',routePlaces:{pickup:{verified:true,displayName:'Hotel Cleveland',formattedAddress:'24 Public Sq, Cleveland, OH 44113',category:'hotel',types:['hotel'],provenance:'wix_atlas_place_details',resolvedAt:'2026-09-02T19:00:00Z'}}};
  const {container}=setup();
  expect(await screen.findByText('Hotel Cleveland')).toBeInTheDocument();
  expect(screen.getAllByText('24 Public Sq, Cleveland, OH 44113')).toHaveLength(2);
  expect(screen.getByText('Hotel')).toBeInTheDocument();
  expect(screen.getByText('Cleveland Hopkins International Airport')).toBeInTheDocument();
  const connectors=container.querySelectorAll('.drive-route-connector');
  expect(connectors).toHaveLength(1);
  expect(connectors[0]).toHaveAttribute('aria-hidden','true');
  expect(connectors[0]).not.toHaveAttribute('role');
  expect(connectors[0]).not.toHaveAttribute('tabindex');
 });

 it('locks rapid repeated taps and advances through the first protected status transition once',async()=>{
  setup();
  const start=await screen.findByRole('button',{name:/Start heading to pickup/});
  fireEvent.click(start);fireEvent.click(start);
  await waitFor(()=>expect(mocks.transitionRequest).toHaveBeenCalledTimes(1));
  expect(window.open).toHaveBeenCalledTimes(1);
  expect(window.open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/maps\.apple\.com\/\?daddr=100%20Main%20St%2C%20Cleveland%2C%20OH&dirflg=d$/),'_blank','noopener,noreferrer');
  expect(await screen.findByRole('button',{name:'Arrived at pickup'})).toBeInTheDocument();
  expect(window.localStorage.getItem('pxpress:drive-session:v1:ride-1')).toContain('heading_to_pickup');
 });

 it.each([
  [{paymentStatus:'pending' as const},/Payment is not verified yet/],
  [{status:'quote_ready' as const},/This ride is Price ready/],
  [{tripType:'Round trip',returnAddress:undefined},/missing its return address/],
  [{pickupAddress:''},/pickup address is missing or invalid/i],
 ])('shows the exact reason that starting is unavailable',async(overrides,message)=>{
  mocks.request={...ride,...overrides};
  setup();
  const start=await screen.findByRole('button',{name:/Start heading to pickup/});
  expect(start).toBeDisabled();
  expect(start).toHaveAttribute('aria-describedby','drive-action-blocked');
  expect(screen.getByText(message)).toBeInTheDocument();
  fireEvent.click(start);
  expect(window.open).not.toHaveBeenCalled();
  expect(mocks.transitionRequest).not.toHaveBeenCalled();
 });

 it('reports a failed status transition after directions have already opened and restores the local step',async()=>{
  mocks.transitionRequest.mockRejectedValueOnce(new Error('Status update failed.'));
  setup();
  fireEvent.click(await screen.findByRole('button',{name:/Start heading to pickup/}));
  expect(window.open).toHaveBeenCalledTimes(1);
  expect(await screen.findByText(/Directions opened, but the drive step was not saved/)).toHaveTextContent('Status update failed.');
  expect(screen.getByRole('button',{name:/Start heading to pickup/})).toBeInTheDocument();
  expect(window.localStorage.getItem('pxpress:drive-session:v1:ride-1')).toContain('"stage":"ready"');
 });

 it('explains that the first tap is still saving and does not open a second navigation window',async()=>{
  let finish!:()=>void;
  mocks.transitionRequest.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve}));
  setup();
  const start=await screen.findByRole('button',{name:/Start heading to pickup/});
  fireEvent.click(start);
  expect(await screen.findByRole('button',{name:'Saving…'})).toBeDisabled();
  expect(screen.getByText(/Saving the previous drive step/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Saving…'}));
  expect(window.open).toHaveBeenCalledTimes(1);
  finish();
  await waitFor(()=>expect(mocks.transitionRequest).toHaveBeenCalledTimes(1));
 });

 it('shows a truthful manual fallback when foreground location permission is denied',async()=>{
  const watchPosition=vi.fn((_ok:PositionCallback,error:PositionErrorCallback)=>{error({code:1,message:'denied',PERMISSION_DENIED:1,POSITION_UNAVAILABLE:2,TIMEOUT:3} as GeolocationPositionError);return 7});
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{watchPosition,clearWatch:vi.fn(),getCurrentPosition:vi.fn()}});
  setup();
  fireEvent.click(await screen.findByRole('button',{name:/Start heading to pickup/}));
  await screen.findByRole('button',{name:'Arrived at pickup'});
  fireEvent.click(screen.getByRole('button',{name:/Allow & start GPS mileage/}));
  expect(await screen.findByText(/Location permission was denied/)).toBeInTheDocument();
  expect(screen.getByText(/Use manual mileage/)).toBeInTheDocument();
 });
 it('finishes a paid ride through the protected completion path so the thank-you is queued once',async()=>{
  setup();
  fireEvent.click(await screen.findByRole('button',{name:/Start heading to pickup/}));
  fireEvent.click(await screen.findByRole('button',{name:'Arrived at pickup'}));
  fireEvent.click(await screen.findByRole('button',{name:/Passenger onboard/}));
  fireEvent.click(await screen.findByRole('button',{name:/Arrived at destination/}));
  await waitFor(()=>expect(mocks.completePaidRide).toHaveBeenCalledTimes(1));
  expect(mocks.completePaidRide).toHaveBeenCalledWith(expect.objectContaining({id:'ride-1',version:4}),'auto');
  expect(mocks.transitionRequest).toHaveBeenCalledTimes(1);
  expect(mocks.transitionRequest).not.toHaveBeenCalledWith('ride-1',expect.anything(),'completed',expect.anything());
 });
 it('blocks remote status changes and saved claims when device persistence fails',async()=>{
  installStorage(true);
  setup();
  expect(await screen.findByText('Device save is unavailable')).toBeInTheDocument();
  const start=screen.getByRole('button',{name:/Start heading to pickup/});
  expect(start).toBeDisabled();
  expect(screen.getByText(/phone cannot save Drive Mode yet/i)).toBeInTheDocument();
  fireEvent.click(start);
  expect(mocks.transitionRequest).not.toHaveBeenCalled();
  expect(screen.queryByText('Saved safely on this device')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Clear device session'}));
  expect(await screen.findByText(/session could not be cleared/)).toBeInTheDocument();
 });
});
