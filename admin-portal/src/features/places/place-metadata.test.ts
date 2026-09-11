import { describe,expect,it } from 'vitest';
import { demoRequests } from '../../demo-data';
import { normalizeVerifiedPlace, placeCategoryLabel, placeForRequest, routeAddress } from './place-metadata';

describe('verified route place presentation',()=>{
  it('uses the canonical full airport name and address without a provider lookup',()=>{
    const request={...demoRequests[0],service:'airport' as const,airport:'CLE',destinationAddress:''};
    expect(placeForRequest(request,'destination')).toMatchObject({displayName:'Cleveland Hopkins International Airport',formattedAddress:'Cleveland Hopkins International Airport, Cleveland, OH 44135',category:'airport'});
    expect(routeAddress(request,'destination')).toBe('Cleveland Hopkins International Airport, Cleveland, OH 44135');
  });

  it('shows business metadata only when the stored record is verified',()=>{
    const request={...demoRequests[1],routePlaces:{destination:{verified:true as const,displayName:'The Ritz-Carlton, Cleveland',formattedAddress:'1515 W 3rd St, Cleveland, OH 44113',category:'hotel',types:['hotel'],provenance:'wix_atlas_place_details',resolvedAt:'2026-09-02T19:00:00Z'}}};
    expect(placeForRequest(request,'destination')?.displayName).toBe('The Ritz-Carlton, Cleveland');
    expect(placeCategoryLabel(placeForRequest(request,'destination'))).toBe('Hotel');
  });

  it('never treats unverified or residential text as a display name',()=>{
    expect(normalizeVerifiedPlace({verified:false,displayName:'Home',formattedAddress:'1 Main St',provenance:'manual',resolvedAt:'2026-09-02T19:00:00Z'})).toBeUndefined();
    const residence=normalizeVerifiedPlace({verified:true,displayName:'The Smith House',formattedAddress:'1 Main St, Cleveland, OH 44113',category:'residence',provenance:'owner_confirmed',resolvedAt:'2026-09-02T19:00:00Z'});
    expect(residence?.displayName).toBeUndefined();
    expect(placeCategoryLabel(residence)).toBe('Residence');
  });
});
