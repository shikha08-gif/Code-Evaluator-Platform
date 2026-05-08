async function register(){
 const userInput = document.getElementById("user");
 const passInput = document.getElementById("pass");
 const confirmInput = document.getElementById("confirmPass");
 const msgEl = document.getElementById("msg");
 const u = userInput.value.trim();
 const p = passInput.value.trim();
 const cp = confirmInput ? confirmInput.value.trim() : '';

 if(!u || !p || !cp){
  msgEl.innerText="⚠ Fill all fields";
  msgEl.style.color="orange";
  return;
 }

 if(p !== cp){
  msgEl.innerText="⚠ Passwords do not match";
  msgEl.style.color="orange";
  return;
 }

 try{
  const res = await fetch('/register', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ username: u, password: p })
  });

  const text = await res.text();

  if(text === 'Registered'){
   msgEl.innerText="✅ Registered successfully";
   msgEl.style.color="#00ffae";
   setTimeout(()=>location.href="login.html",1200);
  } else {
   msgEl.innerText="❌ " + text;
   msgEl.style.color="red";
  }
 } catch(err){
  console.error('Register request failed:', err);
  msgEl.innerText="❌ Server error";
  msgEl.style.color="red";
 }
}



async function login(){
 const userInput = document.getElementById("user");
 const passInput = document.getElementById("pass");
 const msgEl = document.getElementById("msg");
 const u = userInput.value.trim();
 const p = passInput.value.trim();

 if(!u || !p){
  msgEl.innerText="⚠ Fill all fields";
  msgEl.style.color="orange";
  return;
 }

 try{
  const res = await fetch('/login', {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ username: u, password: p })
  });

  const text = await res.text();

  if(text === 'success'){
   msgEl.innerText="✅ Login success";
   msgEl.style.color="#00ffae";
   localStorage.setItem("user", u);
   setTimeout(()=>location.href="index.html",1000);
  } else {
   msgEl.innerText="❌ " + (text === 'invalid' ? 'Wrong username or password' : text);
   msgEl.style.color="red";
  }
 } catch(err){
  console.error('Login request failed:', err);
  msgEl.innerText="❌ Server error";
  msgEl.style.color="red";
 }
}

function resetPassword(){
 let u=user.value.trim();

 if(!u){
  msg.innerText="⚠ Enter your username";
  msg.style.color="orange";
  return;
 }

 if(!localStorage.getItem(u)){
  msg.innerText="❌ User not found";
  msg.style.color="red";
  return;
 }

 let newPass=prompt("Enter new password:");
 if(!newPass || newPass.trim()===""){
  msg.innerText="⚠ Password cannot be empty";
  msg.style.color="orange";
  return;
 }

 let confirmNewPass=prompt("Confirm new password:");
 if(newPass !== confirmNewPass){
  msg.innerText="⚠ Passwords do not match";
  msg.style.color="orange";
  return;
 }

 localStorage.setItem(u, newPass);
 msg.innerText="✅ Password reset successfully";
 msg.style.color="#00ffae";

 setTimeout(()=>location.href="login.html",1500);
}

function goBack(){
 window.history.back();
}