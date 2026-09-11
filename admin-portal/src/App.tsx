import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { Shell } from './components/Shell';
import { StatePanel } from './components/StatePanel';
import { safeOwnerMfaReturnPath } from './features/email-center/mfa-return';

const Login=lazy(()=>import('./pages/Login').then(module=>({default:module.Login})));
const Settings=lazy(()=>import('./pages/Settings').then(module=>({default:module.Settings})));
const Dashboard=lazy(()=>import('./pages/Dashboard').then(module=>({default:module.Dashboard})));
const Requests=lazy(()=>import('./pages/Requests').then(module=>({default:module.Requests})));
const RequestDetail=lazy(()=>import('./pages/RequestDetail').then(module=>({default:module.RequestDetail})));
const Customers=lazy(()=>import('./pages/Customers').then(module=>({default:module.Customers})));
const GuestProfile=lazy(()=>import('./pages/GuestProfile').then(module=>({default:module.GuestProfile})));
const Activity=lazy(()=>import('./pages/Activity').then(module=>({default:module.Activity})));
const AnalyticsV2=lazy(()=>import('./pages/AnalyticsV2').then(module=>({default:module.AnalyticsV2Route})));
const Expenses=lazy(()=>import('./pages/Expenses').then(module=>({default:module.Expenses})));
const Availability=lazy(()=>import('./pages/Availability').then(module=>({default:module.Availability})));
const ManualRideEntry=lazy(()=>import('./pages/ManualRideEntry').then(module=>({default:module.ManualRideEntry})));
const PaymentCenter=lazy(()=>import('./pages/PaymentCenter').then(module=>({default:module.PaymentCenter})));
const CommunicationsCenter=lazy(()=>import('./pages/CommunicationsCenter').then(module=>({default:module.CommunicationsCenter})));
const VehicleRecords=lazy(()=>import('./pages/VehicleRecords').then(module=>({default:module.VehicleRecords})));
const Calendar=lazy(()=>import('./pages/Calendar').then(module=>({default:module.Calendar})));
const Notifications=lazy(()=>import('./pages/Notifications').then(module=>({default:module.Notifications})));
const Feedback=lazy(()=>import('./pages/Feedback').then(module=>({default:module.Feedback})));
const More=lazy(()=>import('./pages/More').then(module=>({default:module.More})));
const DriveMode=lazy(()=>import('./pages/DriveMode').then(module=>({default:module.DriveMode})));
const TaxCenter=lazy(()=>import('./pages/TaxCenter').then(module=>({default:module.TaxCenter})));
const EmailCenter=lazy(()=>import('./pages/EmailCenter').then(module=>({default:module.EmailCenter})));
const EmailOAuthCallback=lazy(()=>import('./pages/EmailOAuthCallback').then(module=>({default:module.EmailOAuthCallback})));
const MfaSetup=lazy(()=>import('./pages/Mfa').then(module=>({default:module.MfaSetup})));
const MfaChallenge=lazy(()=>import('./pages/Mfa').then(module=>({default:module.MfaChallenge})));

export function Protected(){const {user,loading,configured,mfa,authError,retryAuth}=useAuth(),location=useLocation(),returnTo=safeOwnerMfaReturnPath(location.pathname),returnQuery=returnTo==='/'?'':`?returnTo=${encodeURIComponent(returnTo)}`;if(loading||mfa.readStatus==='loading')return <StatePanel kind="loading" title="Securing the owner desk"/>;if(authError)return <StatePanel kind="error" title="Owner sign-in is unavailable" body={authError} retry={()=>void retryAuth()}/>;if(!configured||!user)return <Navigate to={`/owner-access${returnQuery}`} replace/>;if(mfa.readStatus==='unavailable')return <StatePanel kind="error" title="Owner verification is unavailable" body={mfa.error||'Try the security check again.'} retry={()=>void retryAuth()}/>;if(!mfa.verifiedFactorId)return <Navigate to={`/mfa-setup${returnQuery}`} replace/>;if(mfa.currentLevel!=='aal2'&&mfa.currentLevel!=='aal3')return <Navigate to={`/mfa-challenge${returnQuery}`} replace/>;return <Shell><Outlet/></Shell>}
function SettingsRedirect({section}:{section:string}){const location=useLocation(),query=new URLSearchParams(location.search);query.set('section',section);return <Navigate to={'/settings?'+query.toString()} replace/>}
export function App(){return <Suspense fallback={<StatePanel kind="loading" title="Opening Raishawn’s desk"/>}><Routes><Route path="/owner-access" element={<Login/>}/><Route path="/mfa-setup" element={<MfaSetup/>}/><Route path="/mfa-challenge" element={<MfaChallenge/>}/><Route element={<Protected/>}><Route index element={<Dashboard/>}/><Route path="settings" element={<Settings/>}/><Route path="requests" element={<Requests/>}/><Route path="requests/:id" element={<RequestDetail/>}/><Route path="drive/:id" element={<DriveMode/>}/><Route path="calendar" element={<Calendar/>}/><Route path="calendar/settings" element={<SettingsRedirect section="calendar"/>}/><Route path="customers" element={<Customers/>}/><Route path="customers/:id" element={<GuestProfile/>}/><Route path="notifications" element={<Notifications/>}/><Route path="feedback" element={<Feedback/>}/><Route path="notification-settings" element={<SettingsRedirect section="notifications"/>}/><Route path="email" element={<EmailCenter/>}/><Route path="email/google/callback" element={<EmailOAuthCallback/>}/><Route path="more" element={<More/>}/><Route path="analytics" element={<AnalyticsV2/>}/><Route path="expenses" element={<Expenses/>}/><Route path="availability" element={<Availability/>}/><Route path="manual-ride" element={<ManualRideEntry/>}/><Route path="payments" element={<PaymentCenter/>}/><Route path="communications" element={<CommunicationsCenter/>}/><Route path="vehicle-records" element={<VehicleRecords/>}/><Route path="tax-center" element={<TaxCenter/>}/><Route path="activity" element={<Activity/>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes></Suspense>}
