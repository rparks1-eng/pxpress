export function registerOwnerServiceWorker(){
  if(!('serviceWorker'in navigator))return;
  window.addEventListener('load',()=>{void navigator.serviceWorker.register('/admin/owner-notifications-sw.js',{scope:'/admin/'}).catch(()=>undefined)},{once:true});
}
