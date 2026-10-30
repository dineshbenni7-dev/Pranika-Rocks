import { SUPABASE_URL, SUPABASE_ANON_KEY, WORKPLACE_LATITUDE, WORKPLACE_LONGITUDE, GEOFENCE_RADIUS_METERS, PASSKEYS_ENABLED } from "./config.js";

const configured = !SUPABASE_URL.includes("YOUR-PROJECT") && !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");
const $ = id => document.getElementById(id);
const today = () => new Date().toLocaleDateString("en-CA");
const monthNow = () => today().slice(0,7);
$("year").textContent = new Date().getFullYear();
$("todayLabel").textContent = new Date().toLocaleDateString(undefined,{weekday:"long",year:"numeric",month:"long",day:"numeric"});
$("monthFilter").value = monthNow();

let sb=null, currentUser=null, profile=null, scanner=null, attendanceCache=[], pendingQrAction=null, verifiedCoords=null, selfieStream=null, selfieCaptured=false;
if(!configured){$("setupNotice").classList.remove("hidden");$("connection").textContent="Setup required";}
else { sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY); $("connection").textContent="Connected"; }

function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800)}
function message(id,msg,error=false){$(id).textContent=msg;$(id).classList.toggle("error",error)}
function fmt(ts){return ts?new Date(ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"—"}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function setAuthTab(tab){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));$("loginForm").classList.toggle("hidden",tab!=="login");$("registerForm").classList.toggle("hidden",tab!=="register");message("authMessage","")}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>setAuthTab(b.dataset.tab)));
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!sb)return;message("authMessage","Signing in…");const {error}=await sb.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});if(error)message("authMessage",error.message,true);else await loadSession()});
$("registerForm").addEventListener("submit",async e=>{e.preventDefault();if(!sb)return;message("authMessage","Creating account…");const {data,error}=await sb.auth.signUp({email:$("regEmail").value.trim(),password:$("regPassword").value,options:{data:{full_name:$("regName").value.trim()}}});if(error)message("authMessage",error.message,true);else message("authMessage",data.session?"Account created.":"Check your email to confirm registration.")});
$("logoutBtn").addEventListener("click",async()=>{await sb.auth.signOut();showAuth()});
function showAuth(){$("authView").classList.remove("hidden");$("appView").classList.add("hidden");$("logoutBtn").classList.add("hidden");currentUser=null;profile=null}
async function loadSession(){if(!sb)return;const {data:{session}}=await sb.auth.getSession();if(!session){showAuth();return}currentUser=session.user;const {data,error}=await sb.from("profiles").select("*").eq("id",currentUser.id).maybeSingle();if(error||!data){showAuth();message("authMessage",error?.message||"Profile not found. Run the setup SQL again.",true);return}profile=data;$("authView").classList.add("hidden");$("appView").classList.remove("hidden");$("logoutBtn").classList.remove("hidden");$("greeting").textContent=`Hello, ${profile.full_name||"there"}`;$("roleBadge").textContent=profile.role.toUpperCase();$("adminPanel").classList.toggle("hidden",profile.role!=="admin");$("staffPanel").classList.toggle("hidden",profile.role==="admin");await loadReports();if(profile.role==="admin")await loadAdmin();else await loadStaffStatus()}
async function loadReports(){const month=$("monthFilter").value||monthNow();const [yy,mm]=month.split("-").map(Number);const nextMonth=new Date(yy,mm,1).toLocaleDateString("en-CA");let q=sb.from("attendance").select("id,staff_id,work_date,check_in,check_out,method,note,profiles(full_name,email)").gte("work_date",month+"-01").lt("work_date",nextMonth).order("work_date",{ascending:false}).order("check_in",{ascending:false});const {data,error}=await q;if(error){$("attendanceTable").innerHTML=`<tr><td colspan="6">${esc(error.message)}</td></tr>`;return}attendanceCache=data||[];renderAttendance()}
function renderAttendance(){const rows=attendanceCache;$("attendanceTable").innerHTML=rows.length?rows.map(r=>`<tr><td>${esc(r.work_date)}</td><td>${esc(r.profiles?.full_name||r.profiles?.email||"Staff")}</td><td>${fmt(r.check_in)}</td><td>${fmt(r.check_out)}</td><td>${esc(r.method)}</td><td>${esc(r.note||"—")}</td></tr>`).join(""):`<tr><td colspan="6" class="muted">No attendance records for this month.</td></tr>`}
$("monthFilter").addEventListener("change",loadReports);
$("exportBtn").addEventListener("click",()=>{if(!attendanceCache.length){toast("No records to export");return}const cols=["Date","Staff","Email","Check in","Check out","Method","Note"];const lines=[cols,...attendanceCache.map(r=>[r.work_date,r.profiles?.full_name||"",r.profiles?.email||"",r.check_in||"",r.check_out||"",r.method||"",r.note||""])];const csv=lines.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=`pranika-rocks-attendance-${$("monthFilter").value}.csv`;a.click();URL.revokeObjectURL(a.href)});
async function loadAdmin(){const [{data:staff,error:sErr},{data:todayRows,error:aErr}]=await Promise.all([sb.from("profiles").select("id,full_name,email,role,active").order("full_name"),sb.from("attendance").select("staff_id,check_out").eq("work_date",today())]);if(sErr||aErr){toast((sErr||aErr).message);return}const active=(staff||[]).filter(x=>x.active&&x.role==="staff"), present=new Set((todayRows||[]).map(x=>x.staff_id));$("staffCount").textContent=active.length;$("presentCount").textContent=present.size;$("checkoutCount").textContent=(todayRows||[]).filter(x=>x.check_out).length;$("absentCount").textContent=Math.max(0,active.length-present.size);$("manualStaff").innerHTML='<option value="">Select staff member</option>'+active.map(x=>`<option value="${x.id}">${esc(x.full_name||x.email)}</option>`).join("");$("staffTable").innerHTML=(staff||[]).map(x=>`<tr><td>${esc(x.full_name||"—")}</td><td>${esc(x.email)}</td><td>${esc(x.role)}</td><td>${x.active?"Active":"Inactive"}</td></tr>`).join("")||'<tr><td colspan="4">No staff accounts yet.</td></tr>'}
$("refreshBtn").addEventListener("click",async()=>{await loadAdmin();await loadReports();toast("Dashboard refreshed")});
$("manualForm").addEventListener("submit",async e=>{e.preventDefault();const staffId=$("manualStaff").value,action=$("manualAction").value;if(!staffId){message("manualMessage","Choose a staff member.",true);return}const {error}=await recordAttendance(staffId,action,"manual",$("manualNote").value.trim());if(error)message("manualMessage",error.message,true);else{message("manualMessage","Attendance saved.");$("manualNote").value="";await loadAdmin();await loadReports()}});
async function recordAttendance(staffId,action,method,note=""){const {data:existing,error:findErr}=await sb.from("attendance").select("*").eq("staff_id",staffId).eq("work_date",today()).maybeSingle();if(findErr)return {error:findErr};if(action==="check_in"){if(existing)return {error:{message:"This staff member already checked in today."}};return await sb.from("attendance").insert({staff_id:staffId,work_date:today(),check_in:new Date().toISOString(),method,note,marked_by:currentUser.id})}if(!existing)return {error:{message:"No check-in found for today."}};if(existing.check_out)return {error:{message:"Already checked out today."}};return await sb.from("attendance").update({check_out:new Date().toISOString(),note:note||existing.note,method:method==="manual"?"manual":existing.method}).eq("id",existing.id)}
$("newQrBtn").addEventListener("click",async()=>{const token=crypto.randomUUID();const {error}=await sb.from("daily_qr_tokens").upsert({work_date:today(),token,created_by:currentUser.id},{onConflict:"work_date"});if(error){toast(error.message);return}$("qrBox").innerHTML="";new QRCode($("qrBox"),{text:token,width:180,height:180,colorDark:"#172554",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.H});$("qrStatus").textContent="Today's QR code is active. Keep this screen visible for staff.";});
async function loadStaffStatus(){const {data,error}=await sb.from("attendance").select("*").eq("staff_id",currentUser.id).eq("work_date",today()).maybeSingle();if(error){message("staffMessage",error.message,true);return}if(!data){$("staffPunchTitle").textContent="Ready to start?";$("staffPunchHint").textContent="Scan the QR code displayed by your admin to check in.";$("staffTodayStatus").textContent="No attendance yet";$("myCheckIn").textContent="—";$("myCheckOut").textContent="—"}else{$("staffPunchTitle").textContent=data.check_out?"Shift completed":"You're checked in";$("staffPunchHint").textContent=data.check_out?"Your attendance for today is complete.": "Scan the admin QR code again when you finish work.";$("staffTodayStatus").textContent=data.check_out?"Checked out":"Present today";$("myCheckIn").textContent=fmt(data.check_in);$("myCheckOut").textContent=fmt(data.check_out)}}
$("staffRefreshBtn").addEventListener("click",loadStaffStatus);
$("scanBtn").addEventListener("click",async()=>{if(!sb)return;const box=$("reader");box.classList.remove("hidden");$("scanBtn").disabled=true;try{if(!scanner)scanner=new Html5Qrcode("reader");await scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:230,height:230}},async decoded=>{await scanner.stop();box.classList.add("hidden");$("scanBtn").disabled=false;await processQr(decoded)},()=>{});}catch(err){box.classList.add("hidden");$("scanBtn").disabled=false;message("staffMessage","Camera unavailable. Allow camera permission and use HTTPS.",true)}});
async function processQr(token){
  const {data,error}=await sb.from("daily_qr_tokens").select("token,work_date").eq("work_date",today()).eq("token",token).maybeSingle();
  if(error||!data){message("staffMessage","That QR code is invalid or expired.",true);return}
  const {data:existing}=await sb.from("attendance").select("id,check_out").eq("staff_id",currentUser.id).eq("work_date",today()).maybeSingle();
  pendingQrAction=existing?"check_out":"check_in";
  $("verificationPanel").classList.remove("hidden");
  $("locationResult").textContent="Checking your workplace location…";
  $("submitVerifiedBtn").disabled=true;
  $("selfiePreview").classList.add("hidden");$("selfieVideo").classList.add("hidden");
  selfieCaptured=false;verifiedCoords=null;
  if(!navigator.geolocation){$("locationResult").textContent="Location is not supported by this browser.";return}
  if(!WORKPLACE_LATITUDE || !WORKPLACE_LONGITUDE){
    $("locationResult").textContent="Workplace coordinates are not configured in config.js.";
    message("staffMessage","Admin must set workplace latitude and longitude before GPS attendance can work.",true);return;
  }
  navigator.geolocation.getCurrentPosition(pos=>{
    const distance=distanceMeters(pos.coords.latitude,pos.coords.longitude,WORKPLACE_LATITUDE,WORKPLACE_LONGITUDE);
    if(distance>GEOFENCE_RADIUS_METERS){
      $("locationResult").textContent=`Outside permitted area: ${Math.round(distance)} m away; limit ${GEOFENCE_RADIUS_METERS} m.`;
      message("staffMessage","Attendance blocked: outside the workplace geofence.",true);return;
    }
    verifiedCoords={latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy};
    $("locationResult").textContent=`Inside workplace area · ${Math.round(distance)} m from site · GPS accuracy ±${Math.round(pos.coords.accuracy)} m`;
    $("submitVerifiedBtn").disabled=!selfieCaptured;
    message("staffMessage","Location verified. Complete the live selfie step.");
  },err=>{
    $("locationResult").textContent="Location error: "+err.message;
    message("staffMessage","Allow location permission and try again over HTTPS.",true);
  },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
}
function distanceMeters(lat1,lon1,lat2,lon2){
  const rad=x=>x*Math.PI/180,R=6371000,dLat=rad(lat2-lat1),dLon=rad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
$("captureSelfieBtn").addEventListener("click",async()=>{
  try{
    if(!selfieStream){
      selfieStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false});
      $("selfieVideo").srcObject=selfieStream;$("selfieVideo").classList.remove("hidden");
      $("captureSelfieBtn").textContent="Capture selfie";return;
    }
    const v=$("selfieVideo"),c=$("selfieCanvas");c.width=v.videoWidth;c.height=v.videoHeight;
    c.getContext("2d").drawImage(v,0,0,c.width,c.height);
    $("selfiePreview").src=c.toDataURL("image/jpeg",0.82);$("selfiePreview").classList.remove("hidden");
    selfieCaptured=true;$("submitVerifiedBtn").disabled=!verifiedCoords;
    stopSelfieCamera();$("selfieVideo").classList.add("hidden");$("captureSelfieBtn").textContent="Retake selfie";
  }catch(e){message("staffMessage","Camera access failed. Allow camera permission and use HTTPS.",true)}
});
function stopSelfieCamera(){if(selfieStream){selfieStream.getTracks().forEach(t=>t.stop());selfieStream=null}}
$("submitVerifiedBtn").addEventListener("click",async()=>{
  if(!pendingQrAction||!verifiedCoords||!selfieCaptured){message("staffMessage","Complete location and selfie verification first.",true);return}
  const {data:existing}=await sb.from("attendance").select("id,check_out").eq("staff_id",currentUser.id).eq("work_date",today()).maybeSingle();
  const action=existing?"check_out":"check_in";
  const note=`GPS ${verifiedCoords.latitude.toFixed(5)},${verifiedCoords.longitude.toFixed(5)} (±${Math.round(verifiedCoords.accuracy)}m); live selfie captured`;
  let result;
  if(action==="check_in"){
    if(existing){message("staffMessage","Already checked in today.",true);return}
    result=await sb.from("attendance").insert({staff_id:currentUser.id,work_date:today(),check_in:new Date().toISOString(),method:"qr",note,marked_by:currentUser.id});
  }else{
    if(!existing){message("staffMessage","No check-in found for today.",true);return}
    if(existing.check_out){message("staffMessage","Already checked out today.",true);return}
    result=await sb.from("attendance").update({check_out:new Date().toISOString(),method:"qr",note}).eq("id",existing.id);
  }
  if(result.error)message("staffMessage",result.error.message,true);
  else{message("staffMessage",action==="check_in"?"GPS-verified check-in recorded.":"GPS-verified check-out recorded.");$("verificationPanel").classList.add("hidden");$("selfiePreview").classList.add("hidden");pendingQrAction=null;verifiedCoords=null;selfieCaptured=false;await loadStaffStatus();await loadReports()}
});
window.addEventListener("beforeunload",stopSelfieCamera);

if(PASSKEYS_ENABLED){$("passkeyStatus").textContent="A verified WebAuthn backend must be deployed before passkey authentication can be used."}
if(sb){sb.auth.onAuthStateChange((_event,session)=>{if(!session)showAuth()});loadSession()}
