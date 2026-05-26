import { useState, useEffect, useRef } from "react";
import { C } from "../theme";
import { Card, GoldButton } from "../components/UI";
import { db, auth, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where } from "../firebase";

const SUPPORT_EMAIL = "davehack966@gmail.com";
const BOT_REPLIES = [
  "Thanks for reaching out! Our team will get back to you shortly. 🙏",
  "Got it! A support agent will respond within 24 hours.",
  "We've received your message and will look into it right away.",
  "Thank you! Our team is on it. Expected response time: 1–24 hours.",
  "Message received! We'll reach out to you as soon as possible.",
];

export default function SupportScreen({ user, setTab }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [sending, setSending]   = useState(false);
  const [category, setCategory] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const bottomRef = useRef(null);
  const uid = auth.currentUser?.uid;
  const isAdmin = user?.email?.toLowerCase() === SUPPORT_EMAIL.toLowerCase();
  useEffect(() => {
  window.supportChatOpen = showChat;

  window.supportCloseChat = () => {
    setShowChat(false);
  };

  return () => {
    window.supportChatOpen = false;
  };
}, [showChat]);

  // Load messages for this user (or all if admin)
  useEffect(() => {
    if (!uid) return;
    let q;
    if (isAdmin) {
      q = query(collection(db, "support"), orderBy("createdAt", "asc"));
    } else {
      q = query(collection(db, "support"), where("uid","==",uid), orderBy("createdAt","asc"));
    }
    const unsub = onSnapshot(q, snap => {
      const msgs = [];
      snap.forEach(d => msgs.push({ id:d.id, ...d.data() }));
      setMessages(msgs);
    });
    return () => unsub();
  }, [uid, isAdmin]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim() || sending) return;
    setSending(true);
    const msg = {
      uid, text: text.trim(),
      senderName: user?.name || "User",
      senderEmail: user?.email || "",
      isSupport: false,
      createdAt: serverTimestamp(),
      category: category || "general",
    };
    await addDoc(collection(db, "support"), msg);
    setInput("");

    // Auto bot reply after 1.5s if not admin
    if (!isAdmin) {
      setTimeout(async () => {
        const reply = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
        await addDoc(collection(db, "support"), {
          uid, text: reply,
          senderName: "NOVA Support",
          senderEmail: "support@novavault.io",
          isSupport: true,
          createdAt: serverTimestamp(),
          category: category || "general",
        });
      }, 1500);
    }
    setSending(false);
  };

  const CATEGORIES = [
    { id:"withdrawal", label:"💸 Withdrawal", icon:"💸" },
    { id:"account",    label:"👤 Account",    icon:"👤" },
    { id:"transfer",   label:"⇄ Transfer",   icon:"⇄"  },
    { id:"general",    label:"💬 General",    icon:"💬"  },
  ];

  const formatTime = (ts) => {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" });
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 200px)", gap:0 }}>

      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,#0f0f0f,#1a1400)`, border:`1px solid ${C.borderStrong}`, borderRadius:16, padding:"16px 18px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:"50%", background:`linear-gradient(135deg,${C.gold},${C.goldDim})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>💬</div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:C.white }}>NOVA Support</div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:C.green, boxShadow:`0 0 6px ${C.green}` }} />
              <span style={{ fontSize:11, color:C.green, fontWeight:600 }}>Online · Avg reply &lt; 24h</span>
            </div>
          </div>
          {isAdmin && (
            <div style={{ marginLeft:"auto" }}>
              <Badge color={C.red}>ADMIN VIEW</Badge>
            </div>
          )}
        </div>
      </div>

      {/* Category picker — only if no messages yet */}
      {messages.length === 0 && !category && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:10, textAlign:"center" }}>What do you need help with?</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => {
  setCategory(cat.id);
  setShowChat(true);
}}
                onMouseEnter={e => { e.currentTarget.style.borderColor=C.gold; e.currentTarget.style.background=C.bgHover; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.background=C.bgElevated; }}
              >
                <span style={{ fontSize:20 }}>{cat.icon}</span>{cat.label.split(" ")[1]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:12, paddingBottom:8 }}>
        {/* Welcome message */}
        !showChat && (
          <div style={{ display:"flex", justifyContent:"flex-start" }}>
            <div style={{ maxWidth:"80%" }}>
              <div style={{ fontSize:10, color:C.muted, marginBottom:4, marginLeft:4 }}>NOVA Support</div>
              <div style={{ background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:"16px 16px 16px 4px", padding:"12px 16px" }}>
                <div style={{ fontSize:13, color:C.white, lineHeight:1.6 }}>
                  👋 Hi {user?.name?.split(" ")[0] || "there"}! Welcome to NOVA Vault support.<br/><br/>
                  You selected: <span style={{ color:C.gold, fontWeight:700 }}>{CATEGORIES.find(c=>c.id===category)?.label}</span><br/><br/>
                  How can we help you today?
                </div>
              </div>
            </div>
          </div>
        )

        {messages.map((msg, i) => {
          const isMe = !msg.isSupport;
          const showSender = i === 0 || messages[i-1]?.isSupport !== msg.isSupport;
          return (
            <div key={msg.id} style={{ display:"flex", justifyContent:isMe?"flex-end":"flex-start" }}>
              <div style={{ maxWidth:"80%" }}>
                {showSender && (
                  <div style={{ fontSize:10, color:C.muted, marginBottom:4, textAlign:isMe?"right":"left", marginLeft:isMe?0:4, marginRight:isMe?4:0 }}>
                    {isMe ? (user?.name||"You") : msg.senderName||"NOVA Support"}
                    {isAdmin && !isMe && msg.senderEmail && ` · ${msg.senderEmail}`}
                  </div>
                )}
                <div style={{
                  background: isMe ? `linear-gradient(135deg,${C.gold},${C.goldDim})` : C.bgElevated,
                  border: isMe ? "none" : `1px solid ${C.border}`,
                  borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  padding:"12px 16px",
                  boxShadow: isMe ? `0 4px 15px ${C.goldGlow}` : "none",
                }}>
                  <div style={{ fontSize:13, color:isMe?"#000":C.white, lineHeight:1.6, fontWeight:isMe?600:400 }}>{msg.text}</div>
                  <div style={{ fontSize:10, color:isMe?"#00000060":C.muted, marginTop:4, textAlign:"right" }}>{formatTime(msg.createdAt)}</div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      {messages.length > 0 && messages.length < 3 && !isAdmin && (
        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:8 }}>
          {["I need help with my withdrawal","My balance is wrong","I can't log in","Transfer not received"].map(q => (
            <button key={q} onClick={() => sendMessage(q)} style={{ flexShrink:0, padding:"7px 12px", borderRadius:20, background:C.bgElevated, border:`1px solid ${C.border}`, color:C.mutedLight, fontSize:11, cursor:"pointer", whiteSpace:"nowrap" }}>{q}</button>
          ))}
        </div>
      )}

      {/* Input */}
      {(category || messages.length > 0) && (
        <div style={{ display:"flex", gap:10, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Type your message…"
            style={{ flex:1, background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px", color:C.white, fontSize:13, outline:"none" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            style={{ width:46, height:46, borderRadius:"50%", background:input.trim()?`linear-gradient(135deg,${C.gold},${C.goldDim})`:`${C.gold}30`, border:"none", cursor:input.trim()?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, transition:"all 0.2s", flexShrink:0 }}
          >
            {sending ? "…" : "↑"}
          </button>
        </div>
      )}
    </div>
  );
}

function Badge({ children, color = C.gold }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", padding:"2px 8px", borderRadius:20, background:`${color}20`, color, border:`1px solid ${color}40`, textTransform:"uppercase" }}>{children}</span>
  );
}