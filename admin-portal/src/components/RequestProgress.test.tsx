import { render,screen } from '@testing-library/react';
import { describe,expect,it } from 'vitest';
import { demoRequests } from '../demo-data';
import { RequestProgress,requestProgressIndex } from './RequestProgress';

describe('request progress',()=>{
  it('maps verified ride state into the six owner-facing steps',()=>{
    expect(requestProgressIndex(demoRequests[0])).toBe(0);
    expect(requestProgressIndex(demoRequests[1])).toBe(1);
    expect(requestProgressIndex(demoRequests[2])).toBe(4);
    expect(requestProgressIndex(demoRequests[3])).toBe(5);
  });
  it('renders a single current step without provider language',()=>{
    render(<RequestProgress request={demoRequests[1]}/>);
    expect(screen.getByRole('listitem',{current:'step'})).toHaveTextContent('Priced');
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
    expect(screen.queryByText(/provider|webhook|readback/i)).not.toBeInTheDocument();
  });
});
