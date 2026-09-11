import { fireEvent,render,screen } from '@testing-library/react';
import { describe,expect,it,vi } from 'vitest';
import { demoRequests } from '../demo-data';
import { automaticFollowUpPresentation,CompleteRideDialog } from './CompleteRideDialog';

describe('complete ride action',()=>{
  it('uses the scheduled ride time for automatic day or night selection',()=>{
    expect(automaticFollowUpPresentation({pickupTime:'05:59'})).toBe('night');
    expect(automaticFollowUpPresentation({pickupTime:'06:00'})).toBe('day');
    expect(automaticFollowUpPresentation({pickupTime:'17:59'})).toBe('day');
    expect(automaticFollowUpPresentation({pickupTime:'18:00'})).toBe('night');
  });
  it('is accessible on mobile-sized layouts and allows an owner image override',async()=>{
    const request={...demoRequests[2],paymentStatus:'paid' as const,status:'confirmed' as const};
    const onConfirm=vi.fn().mockResolvedValue(undefined);
    render(<CompleteRideDialog request={request} busy={false} onDismiss={()=>{}} onConfirm={onConfirm}/>);
    expect(screen.getByRole('heading',{name:'Mark ride complete'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio',{name:/Evening or night/}));
    fireEvent.click(screen.getByRole('button',{name:'Complete Ride'}));
    expect(onConfirm).toHaveBeenCalledWith('night');
  });
});
