import { render,screen,within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe,expect,it } from 'vitest';
import { AuthProvider } from '../auth';
import { Shell } from './Shell';

describe('owner shell navigation',()=>{
  it('opens the canonical public homepage from the account menu without another tab',()=>{
    render(<MemoryRouter><AuthProvider><Shell><p>Content</p></Shell></AuthProvider></MemoryRouter>);
    const link=screen.getByText('Visit website',{selector:'a'});
    expect(link.closest('.desk-account-menu')).not.toBeNull();
    expect(link).toHaveAttribute('href','https://pxpressllc.com/');
    expect(link).not.toHaveAttribute('target');
  });

  it('keeps the phone bar to five useful destinations',()=>{
    render(<MemoryRouter><AuthProvider><Shell><p>Content</p></Shell></AuthProvider></MemoryRouter>);
    const mobile=screen.getAllByRole('navigation',{name:'Owner navigation'})[1];
    expect(within(mobile).getAllByRole('link')).toHaveLength(5);
    for(const name of ['Today','Requests','Calendar','Guests','More'])expect(within(mobile).getByRole('link',{name})).toBeInTheDocument();
    expect(within(mobile).queryByRole('link',{name:'Analytics'})).not.toBeInTheDocument();
    expect(screen.getByRole('img',{name:'Raishawn B. Parks'})).toBeInTheDocument();
  });

  it('adds Expenses to desktop navigation without adding a sixth phone tab',()=>{
    render(<MemoryRouter><AuthProvider><Shell><p>Content</p></Shell></AuthProvider></MemoryRouter>);
    const [desktop,mobile]=screen.getAllByRole('navigation',{name:'Owner navigation'});
    expect(within(desktop).getByRole('link',{name:'Expenses'})).toHaveAttribute('href','/expenses');
    expect(within(mobile).getAllByRole('link')).toHaveLength(5);
    expect(within(mobile).queryByRole('link',{name:'Expenses'})).not.toBeInTheDocument();
  });

  it('keeps the More tab active for owner-center routes without crowding either navigation',()=>{
    render(<MemoryRouter initialEntries={['/communications']}><AuthProvider><Shell><p>Content</p></Shell></AuthProvider></MemoryRouter>);
    const [desktop,mobile]=screen.getAllByRole('navigation',{name:'Owner navigation'});
    expect(within(desktop).queryByRole('link',{name:'Communications'})).not.toBeInTheDocument();
    expect(within(mobile).getByRole('link',{name:'More'})).toHaveClass('active');
    expect(within(mobile).getAllByRole('link')).toHaveLength(5);
  });
});
