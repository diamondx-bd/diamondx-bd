(() => {
  const config = window.DIAMONDX_CONFIG || {};
  const keyReady = config.anonKey && !config.anonKey.includes("PASTE_");
  const clientReady = Boolean(window.supabase && config.url && keyReady);
  const $ = (id) => document.getElementById(id);
  const grid = $("packageGrid");
  const select = $("packageSelect");
  const result = $("orderResult");
  let db = null, currentUser = null, isAdmin = false, products = [], selectedCategory = "all";

  const defaultProducts = [
    ["25 Diamonds","diamond",25],["50 Diamonds","diamond",50],["115 Diamonds","diamond",115],
    ["240 Diamonds","diamond",240],["355 Diamonds","diamond",355],["480 Diamonds","diamond",480],
    ["610 Diamonds","diamond",610],["1240 Diamonds","diamond",1240],
    ["PUBG 60 UC","pubg",60],["PUBG 325 UC","pubg",325],["PUBG 660 UC","pubg",660],
    ["Weekly Membership","subscription",null],["Monthly Membership","subscription",null],["Level Up Pass","pass",null]
  ];

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function bdt(value) {
    if (value === null || value === undefined || value === "") return "দাম নির্ধারণ হয়নি";
    return "৳ " + Number(value).toLocaleString("en-BD");
  }
  function showMessage(text, good=false) {
    const box=$("siteMessage"); box.hidden=false;
    box.innerHTML=(good?"<h3>সফল</h3>":"<h3>বার্তা</h3>")+escapeHtml(text);
    box.scrollIntoView({behavior:"smooth",block:"center"});
  }
  function setAdminMessage(text) { $("adminMessage").textContent=text; }
  function statusText(status) {
    return ({pending:"Pending",approved:"Approved",rejected:"Rejected"})[status] || status;
  }

  function renderProducts() {
    grid.innerHTML=""; select.innerHTML='<option value="">প্যাকেজ নির্বাচন করুন</option>';
    const visible=products.filter(p=>p.is_active && (selectedCategory==="all" || p.category===selectedCategory || (selectedCategory==="subscription" && ["membership","pass"].includes(p.category))));
    if(!visible.length) {
      grid.innerHTML='<div class="notice">এখনো কোনো সক্রিয় প্যাকেজ নেই। Admin লগইন করে দাম সেট ও প্যাকেজ চালু করুন।</div>';
      $("productStatus").textContent="প্যাকেজ পাওয়া যায়নি";
      return;
    }
    $("productStatus").textContent=visible.length+"টি প্যাকেজ";
    visible.forEach(p=>{
      const card=document.createElement("article"); card.className="package";
      const subtitle=p.category==="pubg"?(p.diamonds?Number(p.diamonds)+" UC":"PUBG UC"):(["subscription","membership"].includes(p.category)?"Subscription":p.category==="pass"?"Level Up Pass":(p.diamonds?Number(p.diamonds)+" Diamonds":"Diamond Pack"));
      card.innerHTML='<div class="gem">◆</div><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(subtitle)+'</p><div class="price">'+escapeHtml(bdt(p.price))+'</div><button type="button" data-product="'+escapeHtml(p.id)+'">এই প্যাকেজ নিন</button>';
      grid.appendChild(card);
      const option=document.createElement("option"); option.value=p.id; option.textContent=p.name+" — "+bdt(p.price); select.appendChild(option);
    });
    fillEditOptions();
  }

  async function loadProducts() {
    $("productStatus").textContent="Database থেকে প্যাকেজ লোড হচ্ছে…";
    const {data,error}=await db.from("products").select("id,name,category,diamonds,price,is_active,sort_order").order("sort_order",{ascending:true});
    if(error) {
      $("productStatus").textContent="প্যাকেজ লোড হয়নি";
      grid.innerHTML='<div class="notice">Supabase products পড়তে সমস্যা: '+escapeHtml(error.message)+'</div>';
      return;
    }
    products=data||[];
    renderProducts();
  }

  function fillEditOptions() {
    const edit=$("editProduct"); edit.innerHTML='<option value="">নতুন প্যাকেজ তৈরি</option>';
    products.forEach(p=>{
      const o=document.createElement("option"); o.value=p.id; o.textContent=p.name; edit.appendChild(o);
    });
  }

  async function refreshAuth(user) {
    currentUser=user||null; isAdmin=false;
    $("logoutBtn").hidden=!currentUser;
    $("openLoginBtn").hidden=Boolean(currentUser); $("openProfileBtn").hidden=!currentUser;
    if(currentUser) {
      const {data,error}=await db.from("profiles").select("role,full_name").eq("id",currentUser.id).maybeSingle();
      if(!error && data && data.role==="admin") isAdmin=true;
    }
    $("adminPanel").hidden=!isAdmin;
    if(isAdmin) { await loadAdminOrders(); fillEditOptions(); }
    if(currentUser) await loadOrderHistory();
  }

  async function loadAdminOrders() {
    if(!isAdmin) return;
    const box=$("adminOrders"); box.textContent="অর্ডার লোড হচ্ছে…";
    const {data,error}=await db.from("orders").select("id,user_id,product_name,player_id,payment_method,transaction_id,price,status,created_at").order("created_at",{ascending:false}).limit(25);
    if(error) { box.textContent="অর্ডার দেখা যাচ্ছে না: "+error.message; return; }
    if(!data || !data.length) { box.textContent="এখনো কোনো অর্ডার নেই।"; return; }
    box.innerHTML="";
    data.forEach(order=>{
      const item=document.createElement("div"); item.className="admin-order";
      item.innerHTML='<strong>'+escapeHtml(order.product_name||"Package")+'</strong> <span class="status-pill">'+escapeHtml(statusText(order.status))+'</span><br>Player ID: '+escapeHtml(order.player_id)+'<br>Payment: '+escapeHtml(order.payment_method)+'<br>Transaction: '+escapeHtml(order.transaction_id||"—")+'<br>Price: '+escapeHtml(bdt(order.price))+'<br><small>'+escapeHtml(new Date(order.created_at).toLocaleString())+'</small><br><select data-order="'+escapeHtml(order.id)+'"><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select>';
      const status=item.querySelector("select"); status.value=order.status;
      status.addEventListener("change",async()=>{
        const {error:updateError}=await db.from("orders").update({status:status.value}).eq("id",order.id);
        if(updateError) { showMessage("অর্ডারের অবস্থা পরিবর্তন হয়নি: "+updateError.message); status.value=order.status; }
        else { order.status=status.value; showMessage("অর্ডারের অবস্থা আপডেট হয়েছে।",true); }
      });
      box.appendChild(item);
    });
  }

  grid.addEventListener("click",event=>{
    const button=event.target.closest("button[data-product]"); if(!button)return;
    select.value=button.dataset.product;
    document.querySelectorAll(".package").forEach(c=>c.classList.remove("selected"));
    button.closest(".package").classList.add("selected");
    $("order").scrollIntoView({behavior:"smooth"});
  });

  $("authForm").addEventListener("submit",async event=>{
    event.preventDefault();
    if(!clientReady){$("authMessage").textContent="প্রথমে config.js-এ Supabase Publishable/anon key বসাতে হবে।";return;}
    const email=$("authEmail").value.trim(), password=$("authPassword").value;
    $("authMessage").textContent="লগইন হচ্ছে…";
    const {data,error}=await db.auth.signInWithPassword({email,password});
    if(error){$("authMessage").textContent="লগইন হয়নি: "+error.message;return;}
    $("authMessage").textContent="লগইন সফল।";
    await refreshAuth(data.user);
  });

  $("signupBtn").addEventListener("click",async()=>{
    if(!clientReady){$("authMessage").textContent="প্রথমে config.js-এ Supabase Publishable/anon key বসাতে হবে।";return;}
    const email=$("authEmail").value.trim(), password=$("authPassword").value;
    if(!email||password.length<6){$("authMessage").textContent="ইমেইল দিন এবং কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড লিখুন।";return;}
    const {data,error}=await db.auth.signUp({email,password});
    $("authMessage").textContent=error?"অ্যাকাউন্ট তৈরি হয়নি: "+error.message:"অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল confirmation চালু থাকলে inbox যাচাই করুন।";
    if(data.user && data.session){await refreshAuth(data.user);closeModal("loginModal");}
  });

  $("logoutBtn").addEventListener("click",async()=>{
    const {error}=await db.auth.signOut();
    if(error){$("authMessage").textContent=error.message;return;}
    await refreshAuth(null); $("authMessage").textContent="লগআউট হয়েছে।";
  });

  $("orderForm").addEventListener("submit",async event=>{
    event.preventDefault();
    if(!currentUser){showMessage("অর্ডার পাঠাতে Account অংশে লগইন করুন।");return;}
    const playerId=$("playerId").value.trim(), product=products.find(p=>p.id===select.value);
    const payment=$("paymentMethod").value, transactionId=$("transactionId").value.trim();
    if(!/^\d{5,15}$/.test(playerId)){alert("সঠিক Player ID লিখুন (৫–১৫টি সংখ্যা)।");return;}
    if(!product||!product.is_active){alert("সক্রিয় প্যাকেজ নির্বাচন করুন।");return;}
    if(product.price===null||product.price===undefined){alert("এই প্যাকেজের দাম Admin এখনো নির্ধারণ করেননি।");return;}
    const payload={user_id:currentUser.id,product_id:product.id,product_name:product.name,player_id:playerId,payment_method:payment,transaction_id:transactionId||null,price:product.price,status:"pending"};
    const {data,error}=await db.from("orders").insert(payload).select("id").single();
    if(error){showMessage("অর্ডার জমা হয়নি: "+error.message);return;}
    result.hidden=false;
    result.innerHTML='<h3>অর্ডার জমা হয়েছে!</h3>Order ID: <b>'+escapeHtml(data.id)+'</b><br>প্যাকেজ: '+escapeHtml(product.name)+'<br>মূল্য: '+escapeHtml(bdt(product.price))+'<br>Status: Pending<p>Admin অর্ডার যাচাই করে আপডেট করবেন।</p>';
    result.scrollIntoView({behavior:"smooth"});
    $("orderForm").reset();
  });

  $("editProduct").addEventListener("change",()=>{
    const p=products.find(x=>x.id===$("editProduct").value);
    if(!p){$("productForm").reset();$("productActive").checked=true;return;}
    $("productName").value=p.name;$("productCategory").value=p.category;
    $("productDiamonds").value=p.diamonds??"";$("productPrice").value=p.price??"";
    $("productActive").checked=Boolean(p.is_active);
  });

  $("productForm").addEventListener("submit",async event=>{
    event.preventDefault();
    if(!isAdmin){setAdminMessage("Admin access পাওয়া যায়নি।");return;}
    const selected=$("editProduct").value;
    const payload={name:$("productName").value.trim(),category:$("productCategory").value,diamonds:$("productDiamonds").value?Number($("productDiamonds").value):null,price:Number($("productPrice").value),is_active:$("productActive").checked};
    if(!payload.name||!Number.isFinite(payload.price)||payload.price<0){setAdminMessage("নাম ও সঠিক দাম দিন।");return;}
    const query=selected?db.from("products").update(payload).eq("id",selected):db.from("products").insert(payload);
    const {error}=await query;
    if(error){setAdminMessage("সেভ হয়নি: "+error.message);return;}
    setAdminMessage("প্যাকেজ সেভ হয়েছে।");
    $("productForm").reset();$("productActive").checked=true;$("editProduct").value="";
    await loadProducts();
  });

  $("seedProducts").addEventListener("click",async()=>{
    if(!isAdmin){setAdminMessage("শুধু Admin এই কাজ করতে পারবেন।");return;}
    const existing=new Set(products.map(p=>p.name.toLowerCase()));
    const rows=defaultProducts.filter(p=>!existing.has(p[0].toLowerCase())).map((p,i)=>({name:p[0],category:p[1],diamonds:p[2],price:0,is_active:false,sort_order:products.length+i+1}));
    if(!rows.length){setAdminMessage("প্রাথমিক প্যাকেজগুলো ইতিমধ্যে আছে।");return;}
    const {error}=await db.from("products").insert(rows);
    if(error){setAdminMessage("প্যাকেজ তৈরি হয়নি: "+error.message);return;}
    setAdminMessage(rows.length+"টি প্যাকেজ যোগ হয়েছে। নিরাপত্তার জন্য সবগুলো বন্ধ রাখা হয়েছে—দাম দিয়ে চালু করুন।");
    await loadProducts();
  });


  function openModal(id){const modal=$(id);if(modal){modal.hidden=false;document.body.classList.add("modal-open");}}
  function closeModal(id){const modal=$(id);if(modal){modal.hidden=true;if(!document.querySelector(".modal-backdrop:not([hidden])"))document.body.classList.remove("modal-open");}}
  $("openLoginBtn").addEventListener("click",()=>openModal("loginModal"));
  $("openProfileBtn").addEventListener("click",()=>{openModal("profileModal");if(currentUser)loadOrderHistory();});
  document.querySelectorAll("[data-close-modal]").forEach(btn=>btn.addEventListener("click",()=>closeModal(btn.dataset.closeModal)));
  document.querySelectorAll(".modal-backdrop").forEach(backdrop=>backdrop.addEventListener("click",event=>{if(event.target===backdrop)closeModal(backdrop.id);}));
  document.addEventListener("keydown",event=>{if(event.key==="Escape")document.querySelectorAll(".modal-backdrop:not([hidden])").forEach(m=>closeModal(m.id));});
  $("addBalanceBtn").addEventListener("click",()=>{$("walletMessage").textContent="ওয়ালেট টপ-আপের জন্য নিরাপদ পেমেন্ট ও Admin approval ব্যবস্থা পরের ধাপে যুক্ত করা হবে।";});
  async function loadOrderHistory(){
    if(!currentUser)return;
    const box=$("orderHistory");box.textContent="অর্ডার লোড হচ্ছে…";
    const {data,error}=await db.from("orders").select("id,product_name,price,status,created_at").eq("user_id",currentUser.id).order("created_at",{ascending:false}).limit(50);
    if(error){box.textContent="অর্ডার হিস্টোরি পাওয়া যায়নি: "+error.message;return;}
    const orders=data||[],completed=orders.filter(o=>o.status==="completed");
    $("completedCount").textContent=completed.length+"টি সম্পন্ন";
    if(!orders.length){box.innerHTML='<div class="history-empty">এখনো কোনো অর্ডার করেননি।</div>';return;}
    box.innerHTML="";
    orders.forEach(o=>{const item=document.createElement("div");item.className="history-item";
      item.innerHTML='<strong>'+escapeHtml(o.product_name||"Diamond package")+'</strong><br><span class="status-pill">'+escapeHtml(statusText(o.status))+'</span><br>মূল্য: '+escapeHtml(bdt(o.price))+'<br><small>'+escapeHtml(new Date(o.created_at).toLocaleString("bn-BD"))+'</small>';
      box.appendChild(item);
    });
  }

  document.querySelectorAll(".category-tab").forEach(tab=>tab.addEventListener("click",()=>{selectedCategory=tab.dataset.filter;document.querySelectorAll(".category-tab").forEach(t=>t.classList.toggle("active",t===tab));renderProducts();}));
  ["navOrders","navWallet","navAccount"].forEach(id=>$(id).addEventListener("click",event=>{event.preventDefault();if(currentUser){openModal("profileModal");loadOrderHistory();}else openModal("loginModal");}));
  $("year").textContent=new Date().getFullYear();
  if(!clientReady) {
    $("productStatus").textContent="Supabase key সেট করা বাকি";
    grid.innerHTML='<div class="notice">Supabase সংযোগ চালু করতে GitHub-এর config.js ফাইলে Publishable/anon key বসাতে হবে।</div>';
    $("authMessage").textContent="config.js-এ key বসানোর পরে লগইন ও অর্ডার চালু হবে।";
    return;
  }
  db=window.supabase.createClient(config.url,config.anonKey);
  loadProducts();
  db.auth.getSession().then(({data})=>refreshAuth(data.session?.user||null));
  db.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>refreshAuth(session?.user||null),0);});
})();
