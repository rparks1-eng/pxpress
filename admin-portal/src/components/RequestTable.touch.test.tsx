import {render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {describe,expect,it} from 'vitest';
import {demoRequests} from '../demo-data';
import {RequestTable} from './RequestTable';
describe('touch request list',()=>{
 it('opens each request from one full-row link with no competing decisions',()=>{
  render(<MemoryRouter><RequestTable items={[demoRequests[0]]}/></MemoryRouter>);
  const link=screen.getByRole('link',{name:/Open/});
  expect(link).toHaveAttribute('href','/requests/'+demoRequests[0].id);
  expect(link).toContainElement(screen.getByText(demoRequests[0].customerName));
 expect(screen.queryAllByRole('button')).toHaveLength(0);
 expect(screen.getByText('7:15 AM')).toBeInTheDocument();
 });
 it('keeps the route labels and received time attached to the actual request record',()=>{
  render(<MemoryRouter><RequestTable items={[demoRequests[0]]}/></MemoryRouter>);
  expect(screen.getByText('Pickup')).toBeInTheDocument();
  expect(screen.getByText('Drop-off')).toBeInTheDocument();
  expect(screen.getByText(demoRequests[0].pickupAddress)).toBeInTheDocument();
  expect(screen.getByText(demoRequests[0].destinationAddress!)).toBeInTheDocument();
  const received=screen.getByText('Received').parentElement?.querySelector('time');
  expect(received).toHaveAttribute('datetime',demoRequests[0].createdAt);
  expect(received).toHaveTextContent('Aug 29, 2026, 9:18 AM Eastern');
 });
});
