// reset-demo.js

const STORAGE_USERS = "btx_users_v1";

function loadUsers(){
  const raw = localStorage.getItem(STORAGE_USERS);
  if(!raw) return [];
  try{return JSON.parse(raw);}catch(e){return [];}
}
function saveUsers(users){
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

document.getElementById("resetForm").addEventListener("submit", e=>{
  e.preventDefault();

  const userVal = document.getElementById("rsUser").value.trim().toLowerCase();
  const pass1   = document.getElementById("rsPass1").value;
  const pass2   = document.getElementById("rsPass2").value;

  if(pass1.length < 4){
    alert("🔐 নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের দিন।");
    return;
  }
  if(pass1 !== pass2){
    alert("❌ Password দুটো মিলছে না।");
    return;
  }

  const users = loadUsers();
  const idx = users.findIndex(u =>
    u.username === userVal || u.email === userVal
  );

  if(idx === -1){
    alert("⚠ এই Username/Email দিয়ে কোনো একাউন্ট পাওয়া যায়নি।");
    return;
  }

  users[idx].password = pass1;
  saveUsers(users);

  alert("✅ Password reset successful! এখন নতুন password দিয়ে Login করুন।");
  window.location.href = "login.html?reset=1";
});