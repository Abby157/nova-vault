import { useState, useMemo, useEffect } from "react";
import { C } from "../theme";
import { CRYPTO_DATA } from "../data";
import { Card, Badge, GoldDivider } from "../components/UI";

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

import { db, auth } from "../firebase";

const TYPE_CONFIG = {
  receive: {
    icon: "↓",
    label: "Received",
    color: C.green,
    bg: `${C.green}15`,
  },

  send: {
    icon: "↑",
    label: "Sent",
    color: C.red,
    bg: `${C.red}15`,
  },

  swap: {
    icon: "⇄",
    label: "Swapped",
    color: C.gold,
    bg: `${C.goldGlow}`,
  },
};

function TxRow({ tx, onClick, active }) {
  const cfg = TYPE_CONFIG[tx.type];

  const isSwap = tx.type === "swap";

  const assetLabel = isSwap
    ? `${tx.fromAsset} → ${tx.toAsset}`
    : tx.asset;

  const sign =
    tx.type === "receive"
      ? "+"
      : tx.type === "send"
      ? "-"
      : "⇄";

  const amtColor =
    tx.type === "receive"
      ? C.green
      : tx.status === "approved"
      ? C.green
      : tx.status === "pending"
      ? "#F7931A"
      : C.white;

  return (
    <div
      onClick={onClick}
      style={{
        padding: "16px 18px",
        cursor: "pointer",
        background: active ? `${cfg.color}08` : "transparent",
        transition: "background 0.15s",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            flexShrink: 0,
            background: cfg.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            color: cfg.color,
            fontWeight: 700,
          }}
        >
          {cfg.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.white,
              }}
            >
              {cfg.label} {assetLabel}
            </span>

            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: amtColor,
                whiteSpace: "nowrap",
                marginLeft: 8,
              }}
            >
              {sign}$
              {Number(tx.usd).toLocaleString("en-US", {
                minimumFractionDigits: 2,
              })}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 4,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: C.muted,
              }}
            >
              {tx.date} · {tx.time}
            </span>

            <Badge
              color={
                tx.status === "approved"
                  ? C.green
                  : "#F7931A"
              }
            >
              {tx.status}
            </Badge>
          </div>
        </div>
      </div>

      {active && (
        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {[
            [
              "Amount",
              isSwap
                ? `${tx.amount} ${tx.fromAsset}`
                : `${tx.amount} ${tx.asset}`,
            ],

            [
              tx.type === "receive"
                ? "From"
                : tx.type === "send"
                ? "To"
                : "Protocol",

              tx.from || tx.to || "Uniswap v3",
            ],

            ["Network", "Ethereum Mainnet"],

            ["Status", tx.status],

            [
              "TX Hash",
              tx.txHash || "Awaiting Confirmation",
            ],
          ].map(([label, val]) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: C.muted,
                }}
              >
                {label}
              </span>

              <span
                style={{
                  fontSize: 12,
                  color: C.mutedLight,
                  fontWeight: 600,
                  fontFamily:
                    typeof val === "string" &&
                    val.startsWith("0x")
                      ? "monospace"
                      : "inherit",
                }}
              >
                {val}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryBar({ filtered }) {
  const totIn = filtered
    .filter((t) => t.type === "receive")
    .reduce((s, t) => s + t.usd, 0);

  const totOut = filtered
    .filter((t) => t.type === "send")
    .reduce((s, t) => s + t.usd, 0);

  const net = totIn - totOut;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3,1fr)",
        gap: 8,
      }}
    >
      {[
        {
          label: "Total In",
          value: `+$${totIn.toLocaleString("en-US")}`,
          color: C.green,
        },

        {
          label: "Total Out",
          value: `-$${totOut.toLocaleString("en-US")}`,
          color: C.red,
        },

        {
          label: "Net",
          value: `${net >= 0 ? "+" : "-"}$${Math.abs(
            net
          ).toLocaleString("en-US")}`,
          color: net >= 0 ? C.green : C.red,
        },
      ].map(({ label, value, color }) => (
        <Card
          key={label}
          style={{
            padding: "12px 14px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {label}
          </div>

          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color,
              marginTop: 4,
            }}
          >
            {value}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function TransactionScreen() {
  const [transactions, setTransactions] = useState([]);

  const [search, setSearch] = useState("");

  const [filterType, setFilterType] = useState("all");

  const [filterAsset, setFilterAsset] = useState("all");

  const [sortBy, setSortBy] = useState("newest");

  const [activeId, setActiveId] = useState(null);

  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "withdrawals"),

      where("userId", "==", auth.currentUser.uid),

      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,

          type: "send",

          asset: data.currency || "USDT",

          usd: Number(data.amount || 0),

          amount: Number(data.amount || 0),

          status: data.status || "pending",

          date: new Date().toLocaleDateString(),

          time: new Date().toLocaleTimeString(),

          to: data.walletAddress || "Unknown",

          txHash: data.txHash || "",
        };
      });

      setTransactions(items);
    });

    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    let list = [...transactions];

    if (search) {
      const q = search.toLowerCase();

      list = list.filter(
        (t) =>
          (t.asset || "")
            .toLowerCase()
            .includes(q) ||

          (t.from || t.to || "")
            .toLowerCase()
            .includes(q) ||

          t.type.includes(q)
      );
    }

    if (filterType !== "all") {
      list = list.filter(
        (t) => t.type === filterType
      );
    }

    if (filterAsset !== "all") {
      list = list.filter(
        (t) => t.asset === filterAsset
      );
    }

    if (sortBy === "newest") {
      list.sort((a, b) =>
        a.id < b.id ? 1 : -1
      );
    }

    if (sortBy === "oldest") {
      list.sort((a, b) =>
        a.id > b.id ? 1 : -1
      );
    }

    if (sortBy === "largest") {
      list.sort((a, b) => b.usd - a.usd);
    }

    return list;
  }, [
    transactions,
    search,
    filterType,
    filterAsset,
    sortBy,
  ]);

  const grouped = useMemo(() => {
    const groups = {};

    filtered.forEach((tx) => {
      if (!groups[tx.date]) {
        groups[tx.date] = [];
      }

      groups[tx.date].push(tx);
    });

    return Object.entries(groups);
  }, [filtered]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <SummaryBar filtered={filtered} />

      {grouped.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 0",
            color: C.muted,
          }}
        >
          No transactions found
        </div>
      ) : (
        grouped.map(([date, txs]) => (
          <div key={date}>
            <div
              style={{
                fontSize: 11,
                color: C.muted,
                marginBottom: 8,
              }}
            >
              {date}
            </div>

            <Card
              hover={false}
              style={{
                padding: 0,
                overflow: "hidden",
              }}
            >
              {txs.map((tx, i) => (
                <div key={tx.id}>
                  <TxRow
                    tx={tx}
                    active={activeId === tx.id}
                    onClick={() =>
                      setActiveId(
                        activeId === tx.id
                          ? null
                          : tx.id
                      )
                    }
                  />

                  {i < txs.length - 1 && (
                    <GoldDivider margin="0 18px" />
                  )}
                </div>
              ))}
            </Card>
          </div>
        ))
      )}
    </div>
  );
}