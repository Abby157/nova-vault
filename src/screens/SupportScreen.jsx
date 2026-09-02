import { useState, useEffect, useRef, useMemo } from "react";
import { Banknote, User, ArrowLeftRight, MessageCircle } from "lucide-react";
import { C } from "../theme";
import { FeelButton } from "../components/UI";
import { db, auth, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, where } from "../firebase";

const SUPPORT_EMAIL = "davehack966@gmail.com";
const BOT_REPLIES = [
  "Thanks for reaching out! Our team will get back to you shortly. 🙏",
  "Got it! A support agent will respond within 24 hours.",
  "We've received your message and will look into it right away.",
  "Thank you! Our team is on it. Expected response time: 1–24 hours.",
  "Message received! We'll reach out to you as soon as possible.",
];

function Badge({ children, color = C.gold }) {
  return (
    <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", padding:"2px 8px", borderRadius:20, background:`${color}20`, color, border:`1px solid ${color}40`, textTransform:"uppercase" }}>{children}</span>
  );
}

export default function SupportScreen({ user, setTab }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState("");
  const [sending, setSending]   = useState(false);
  const [category, setCategory] = useState(null);
  const [selectedCustomerUid, setSelectedCustomerUid] = useState(null);
  const bottomRef = useRef(null);
  const uid = auth.currentUser?.uid;
  const isAdmin = user?.email?.toLowerCase() === SUPPORT_EMAIL.toLowerCase();

  // Only intercept the header back-button while there's a "sub-screen" open
  // that should collapse rather than navigate away: a picked-but-not-yet-
  // sent category for a customer, or an open conversation for admin.
  const inPreChatState = isAdmin ? selectedCustomerUid !== null : (!!category && messages.length === 0);
  useEffect(() => {
    window.supportChatOpen = inPreChatState;
    window.supportCloseChat = () => { if (isAdmin) setSelectedCustomerUid(null); else setCategory(null); };
    return () => { window.supportChatOpen = false; };
  }, [inPreChatState, isAdmin]);

  // Load messages for this user (or every customer's, if admin)
  useEffect(() => {
    if (!uid) return;
    // A where()+orderBy() on different fields needs a Firestore composite
    // index that isn't deployed for this project, so — like AdminScreen's
    // partner-scoped queries — the user's own query filters only and sorts
    // client-side instead of relying on a server-side orderBy.
    const q = isAdmin
      ? query(collection(db, "support"), orderBy("createdAt", "asc"))
      : query(collection(db, "support"), where("uid","==",uid));
    const unsub = onSnapshot(q, snap => {
      const msgs = [];
      snap.forEach(d => msgs.push({ id:d.id, ...d.data() }));
      if (!isAdmin) {
        msgs.sort((a,b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));
      }
      setMessages(msgs);
    }, err => console.error("Support messages failed to load:", err));
    return () => unsub();
  }, [uid, isAdmin]);

  // Admin sees one conversation per distinct customer instead of a single
  // flat feed of everyone's messages mixed together.
  const conversations = useMemo(() => {
    if (!isAdmin) return [];
    const byUid = new Map();
    messages.forEach(m => {
      if (!byUid.has(m.uid)) byUid.set(m.uid, []);
      byUid.get(m.uid).push(m);
    });
    return Array.from(byUid.entries()).map(([custUid, msgs]) => {
      const sorted = [...msgs].sort((a,b) => (a.createdAt?.seconds||0) - (b.createdAt?.seconds||0));
      const last = sorted[sorted.length - 1];
      const fromCustomer = [...sorted].reverse().find(m => !m.isSupport) || sorted[0];
      return {
        uid: custUid,
        name: fromCustomer?.senderName || "User",
        email: fromCustomer?.senderEmail || "",
        lastText: last?.text || "",
        lastTime: last?.createdAt,
        messages: sorted,
      };
    }).sort((a,b) => (b.lastTime?.seconds||0) - (a.lastTime?.seconds||0));
  }, [messages, isAdmin]);

  const activeConversation = isAdmin ? conversations.find(c => c.uid === selectedCustomerUid) : null;
  const threadMessages = isAdmin ? (activeConversation?.messages || []) : messages;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [threadMessages]);

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

  // Admin replies must be tagged with the CUSTOMER's uid (not the admin's
  // own) so they land in that customer's own message query, and marked
  // isSupport so they render as an incoming message on the customer's side.
  const sendAdminReply = async (text) => {
    if (!text.trim() || sending || !selectedCustomerUid) return;
    setSending(true);
    await addDoc(collection(db, "support"), {
      uid: selectedCustomerUid,
      text: text.trim(),
      senderName: "NOVA Support",
      senderEmail: "support@novavault.io",
      isSupport: true,
      createdAt: serverTimestamp(),
      category: activeConversation?.messages?.[0]?.category || "general",
    });
    setInput("");
    setSending(false);
  };

  const CATEGORIES = [
    { id:"withdrawal", label:"Withdrawal", icon:Banknote },
    { id:"account",    label:"Account",    icon:User },
    { id:"transfer",   label:"Transfer",   icon:ArrowLeftRight },
    { id:"general",    label:"General",    icon:MessageCircle },
  ];

  const formatTime = (ts) => {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" });
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 200px)", gap:0 }}>

      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,#0f0f0f,#1f1005)`, border:`1px solid ${C.borderStrong}`, borderRadius:16, padding:"16px 18px", marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:"50%", background:`linear-gradient(135deg,${C.gold},${C.goldDim})`, display:"flex", alignItems:"center", justifyContent:"center", color:"#000" }}><MessageCircle size={19} strokeWidth={2.2} /></div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:C.white }}>NOVA Support</div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:2 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:C.green, boxShadow:`0 0 6px ${C.green}` }} />
              <span style={{ fontSize:11, color:C.green, fontWeight:600 }}>Online · Avg reply &lt; 24h</span>
            </div>
          </div>
          {isAdmin && (
            <div style={{ marginLeft:"auto" }}>
              <Badge color={C.red}>{activeConversation ? "REPLYING" : `${conversations.length} CHAT${conversations.length!==1?"S":""}`}</Badge>
            </div>
          )}
        </div>
      </div>

      {/* ── Admin: conversation list (one row per customer) ── */}
      {isAdmin && !activeConversation && (
        conversations.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:C.muted }}>
            <div style={{ fontSize:32, marginBottom:8 }}>💬</div>
            <div>No support messages yet</div>
          </div>
        ) : (
          <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:8 }}>
            {conversations.map(c => (
              <div
                key={c.uid}
                onClick={() => setSelectedCustomerUid(c.uid)}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:14, background:C.bgElevated, border:`1px solid ${C.border}`, cursor:"pointer" }}
              >
                <div style={{ width:38, height:38, borderRadius:"50%", flexShrink:0, background:`linear-gradient(135deg,${C.gold},${C.goldDim})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:"#000" }}>
                  {(c.name||"?")[0].toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:C.white, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
                    <span style={{ fontSize:10, color:C.muted, flexShrink:0 }}>{formatTime(c.lastTime)}</span>
                  </div>
                  <div style={{ fontSize:11, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:2 }}>{c.email}</div>
                  <div style={{ fontSize:12, color:C.mutedLight, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:4 }}>{c.lastText}</div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Customer: category picker — only if no messages yet ── */}
      {!isAdmin && messages.length === 0 && !category && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:10, textAlign:"center" }}>What do you need help with?</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {CATEGORIES.map(cat => (
              <FeelButton
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                style={{
                  display:"flex", alignItems:"center", gap:8,
                  padding:"14px 16px", borderRadius:12,
                  background:C.bgElevated, border:`1px solid ${C.border}`,
                  color:C.white, fontSize:13, fontWeight:600,
                  cursor:"pointer", transition:"all 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=C.gold; e.currentTarget.style.background=C.bgHover; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.background=C.bgElevated; }}
              >
                <cat.icon size={19} strokeWidth={2} />
                <span>{cat.label}</span>
              </FeelButton>
            ))}
          </div>
        </div>
      )}

      {/* ── Thread view — a customer's own chat, or (for admin) the
          selected customer's conversation. Anchored to the bottom so a
          short conversation sits near the input instead of floating at
          the top with a big gap. ── */}
      {(!isAdmin || activeConversation) && (
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", justifyContent:"flex-end", gap:12, paddingBottom:8 }}>
          {isAdmin && activeConversation && (
            <div style={{ fontSize:11, color:C.muted, textAlign:"center", marginBottom:4 }}>
              {activeConversation.name} · {activeConversation.email}
            </div>
          )}

          {/* Welcome message (customer only) */}
          {!isAdmin && category && messages.length === 0 && (
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
          )}

          {threadMessages.map((msg, i) => {
            // For a customer, "me" is their own sent messages. For admin
            // inside a customer's thread, "me" is the admin's own replies
            // (isSupport:true) — the opposite mapping.
            const isMe = isAdmin ? msg.isSupport === true : !msg.isSupport;
            const showSender = i === 0 || threadMessages[i-1]?.isSupport !== msg.isSupport;
            return (
              <div key={msg.id} style={{ display:"flex", justifyContent:isMe?"flex-end":"flex-start" }}>
                <div style={{ maxWidth:"80%" }}>
                  {showSender && (
                    <div style={{ fontSize:10, color:C.muted, marginBottom:4, textAlign:isMe?"right":"left", marginLeft:isMe?0:4, marginRight:isMe?4:0 }}>
                      {isMe ? "You" : (msg.senderName || "NOVA Support")}
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
      )}

      {/* Quick replies (customer only) */}
      {!isAdmin && messages.length > 0 && messages.length < 3 && (
        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:8 }}>
          {["I need help with my withdrawal","My balance is wrong","I can't log in","Transfer not received"].map(q => (
            <FeelButton key={q} onClick={() => sendMessage(q)} style={{ flexShrink:0, padding:"7px 12px", borderRadius:20, background:C.bgElevated, border:`1px solid ${C.border}`, color:C.mutedLight, fontSize:11, cursor:"pointer", whiteSpace:"nowrap" }}>{q}</FeelButton>
          ))}
        </div>
      )}

      {/* Input — hidden entirely for admin until a conversation is open */}
      {(isAdmin ? !!activeConversation : (category || messages.length > 0)) && (
        <div style={{ display:"flex", gap:10, paddingTop:8, borderTop:`1px solid ${C.border}` }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); isAdmin ? sendAdminReply(input) : sendMessage(input); } }}
            placeholder={isAdmin ? "Reply as NOVA Support…" : "Type your message…"}
            style={{ flex:1, background:C.bgElevated, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px", color:C.white, fontSize:13, outline:"none" }}
          />
          <FeelButton
            onClick={() => isAdmin ? sendAdminReply(input) : sendMessage(input)}
            disabled={!input.trim() || sending}
            style={{ width:46, height:46, borderRadius:"50%", background:input.trim()?`linear-gradient(135deg,${C.gold},${C.goldDim})`:`${C.gold}30`, border:"none", cursor:input.trim()?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, transition:"all 0.2s", flexShrink:0 }}
          >
            {sending ? "…" : "↑"}
          </FeelButton>
        </div>
      )}
    </div>
  );
}