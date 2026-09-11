import { fireEvent,render,screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach,describe,expect,it,vi } from 'vitest';
import { NotificationBanners } from './NotificationBanners';

const actions=vi.hoisted(()=>({dismissBanner:vi.fn(),markRead:vi.fn()}));
vi.mock('./OwnerNotificationsProvider',()=>({useOwnerNotifications:()=>({
  ...actions,banners:[{notification:{id:'request-1',kind:'new_request',priority:3,title:'New ride request',detail:'Airport pickup',requestId:'ride-1'}}],
})}));

function pointer(target:Element,type:string,x:number,y:number){
  const event=new MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0});
  Object.defineProperties(event,{pointerId:{value:1},isPrimary:{value:true},pointerType:{value:'touch'}});
  fireEvent(target,event);
}
function setup(){
  const view=render(<MemoryRouter><NotificationBanners/></MemoryRouter>);
  return view.container.querySelector('article')!;
}

describe('notification banner gestures',()=>{
  beforeEach(()=>vi.clearAllMocks());
  it('dismisses only the banner after an upward swipe',()=>{
    const banner=setup();
    pointer(banner,'pointerdown',100,160);
    pointer(banner,'pointermove',103,105);
    pointer(banner,'pointerup',103,105);
    expect(actions.dismissBanner).toHaveBeenCalledExactlyOnceWith('request-1');
    expect(actions.markRead).not.toHaveBeenCalled();
  });
  it.each([[100,140],[100,220],[170,110]])('retains short, downward and mostly horizontal drags (%s,%s)',(x,y)=>{
    const banner=setup();
    pointer(banner,'pointerdown',100,160);
    pointer(banner,'pointermove',x,y);
    pointer(banner,'pointerup',x,y);
    expect(actions.dismissBanner).not.toHaveBeenCalled();
    expect(banner.style.getPropertyValue('--banner-swipe-y')).toBe('0px');
  });
  it('resets cancelled gestures without dismissal',()=>{
    const banner=setup();
    pointer(banner,'pointerdown',100,160);
    pointer(banner,'pointermove',100,100);
    pointer(banner,'pointercancel',100,100);
    pointer(banner,'pointerup',100,100);
    expect(actions.dismissBanner).not.toHaveBeenCalled();
  });
  it('preserves Open taps and the explicit dismiss button',()=>{
    setup();
    const open=screen.getByRole('link',{name:'Open'});
    pointer(open,'pointerdown',100,160);
    pointer(open,'pointerup',100,160);
    fireEvent.click(open,{detail:1});
    expect(actions.markRead).toHaveBeenCalledWith('request-1');
    fireEvent.click(screen.getByRole('button',{name:'Dismiss New ride request banner'}));
    expect(actions.dismissBanner).toHaveBeenCalledWith('request-1');
  });
  it('does not activate Open after a drag, but keeps keyboard activation available',()=>{
    setup();
    const open=screen.getByRole('link',{name:'Open'});
    pointer(open,'pointerdown',100,160);
    pointer(open,'pointermove',100,140);
    pointer(open,'pointerup',100,140);
    fireEvent.click(open,{detail:1});
    expect(actions.markRead).not.toHaveBeenCalled();
    fireEvent.click(open,{detail:0});
    expect(actions.markRead).toHaveBeenCalledWith('request-1');
  });
});
