const packages = [
  {id:"25",diamonds:"25 Diamonds",note:"Starter Pack"},
  {id:"50",diamonds:"50 Diamonds",note:"Mini Pack"},
  {id:"115",diamonds:"115 Diamonds",note:"Popular Pack"},
  {id:"240",diamonds:"240 Diamonds",note:"Value Pack"},
  {id:"355",diamonds:"355 Diamonds",note:"Plus Pack"},
  {id:"480",diamonds:"480 Diamonds",note:"Mega Pack"},
  {id:"610",diamonds:"610 Diamonds",note:"Pro Pack"},
  {id:"1240",diamonds:"1240 Diamonds",note:"Ultimate Pack"}
];
const grid=document.getElementById("packageGrid");
const select=document.getElementById("packageSelect");
packages.forEach((item)=>{
  const card=document.createElement("article");
  card.className="package";
  card.innerHTML=`<div class="gem">◆</div><h3>${item.diamonds}</h3><p>${item.note}</p><div class="price">মূল্য শিগগিরই জানানো হবে</div><button type="button" data-package="${item.id}">এই প্যাকেজ নিন</button>`;
  grid.appendChild(card);
  const option=document.createElement("option");option.value=item.id;option.textContent=item.diamonds;select.appendChild(option);
});
grid.addEventListener("click",(event)=>{
  const button=event.target.closest("button[data-package]");if(!button)return;
  select.value=button.dataset.package;
  document.querySelectorAll(".package").forEach(card=>card.classList.remove("selected"));
  button.closest(".package").classList.add("selected");
  document.getElementById("order").scrollIntoView({behavior:"smooth"});
});
document.getElementById("orderForm").addEventListener("submit",(event)=>{
  event.preventDefault();
  const playerId=document.getElementById("playerId").value.trim();
  const chosen=packages.find(item=>item.id===select.value);
  const phone=document.getElementById("phone").value.trim();
  const payment=document.getElementById("paymentMethod").value;
  if(!/^\d{5,15}$/.test(playerId)){alert("সঠিক Player ID লিখুন (৫–১৫টি সংখ্যা)।");return;}
  if(!chosen){alert("একটি প্যাকেজ নির্বাচন করুন।");return;}
  if(!/^(01)[0-9]{9}$/.test(phone)){alert("সঠিক বাংলাদেশি মোবাইল নম্বর লিখুন।");return;}
  const result=document.getElementById("orderResult");
  result.hidden=false;
  result.innerHTML=`<h3>ডেমো অর্ডারের বিবরণ তৈরি হয়েছে</h3><b>Player ID:</b> ${escapeHtml(playerId)}<br><b>প্যাকেজ:</b> ${chosen.diamonds}<br><b>পেমেন্ট মাধ্যম:</b> ${escapeHtml(payment)}<br><b>যোগাযোগ:</b> ${escapeHtml(phone)}<p>এটি শুধু প্রিভিউ। আপনার অর্ডার কোথাও জমা হয়নি এবং কোনো টাকা পাঠাবেন না। লাইভ অর্ডার ব্যবস্থা যুক্ত করার পর অর্ডার নিশ্চিত করা যাবে।</p>`;
  result.scrollIntoView({behavior:"smooth"});
});
function escapeHtml(value){return value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));}
document.getElementById("year").textContent=new Date().getFullYear();
