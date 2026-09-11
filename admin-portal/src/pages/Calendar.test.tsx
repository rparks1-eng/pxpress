import {fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {describe,expect,it,vi} from 'vitest';
import {demoRequests} from '../demo-data';
import {CalendarContent,calendarRideState,scheduledRequests,upcomingScheduledRequests} from './Calendar';

vi.mock('../lib/supabase',()=>({isSupabaseConfigured:true}));
vi.mock('../lib/repository',()=>({
  getGoogleCalendarConnection:vi.fn().mockResolvedValue({connected:false,syncEnabled:false}),
  startGoogleCalendarConnection:vi.fn().mockResolvedValue('https://accounts.google.com/o/oauth2/v2/auth'),
}));

describe('owner calendar',()=>{
  it('keeps tentative, paid-confirmed, and in-progress rides in one schedule',()=>{
    const pending={...demoRequests[0],status:'deposit_pending' as const};
    const paid={...demoRequests[0],id:'paid',status:'confirmed' as const,paymentStatus:'paid' as const};
    const progress={...demoRequests[0],id:'progress',status:'in_progress' as const};
    expect(scheduledRequests([pending,paid,progress])).toHaveLength(3);
    expect(calendarRideState(pending).label).toBe('Tentative / awaiting payment');
    expect(calendarRideState(paid).label).toBe('Paid / confirmed');
    expect(calendarRideState(progress).label).toBe('In progress');
  });

  it('uses the Ohio business day when selecting upcoming rides',()=>{
    const pending={...demoRequests[0],status:'deposit_pending' as const,pickupDate:'2026-09-01'};
    expect(upcomingScheduledRequests([pending],new Date('2026-09-02T02:30:00Z'))).toHaveLength(1);
  });

  it('shows one selected day and no connection diagnostics',()=>{
    const key=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const ride={...demoRequests[0],pickupDate:key,status:'confirmed' as const};
    render(<MemoryRouter><CalendarContent items={[ride]}/></MemoryRouter>);
    expect(screen.getByRole('region',{name:'Selected day rides'})).toBeInTheDocument();
    expect(screen.getByText(ride.customerName)).toBeInTheDocument();
    expect(screen.queryByRole('button',{name:'Connect Google Calendar'})).not.toBeInTheDocument();
    expect(screen.getByRole('link',{name:'Calendar settings'})).toHaveAttribute('href','/calendar/settings');
    expect(screen.getByRole('link',{name:'Call guest'})).toHaveAttribute('href','tel:2165550137');
    fireEvent.click(screen.getByRole('button',{name:'Next week'}));
    expect(screen.queryByText(ride.customerName)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Today'}));
    expect(screen.getByText(ride.customerName)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Show month'}));
    fireEvent.click(screen.getByRole('button',{name:'Next month'}));
    expect(screen.queryByText(ride.customerName)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Today'}));
    expect(screen.getByText(ride.customerName)).toBeInTheDocument();
  });
});
