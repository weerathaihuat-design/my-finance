import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const dbStore = getStore("finance_db");
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (req.method === "POST" && action === "webhook") {
    try {
      const body = await req.json();
      let rawData = await dbStore.get("db", { type: "json" }) || { transactions: [], plans: [], debts: [], myDebts: [], bankRules: {}, categories: [] };
      const rawText = body.text || "";
      const appName = body.app || "Mobile Banking";
      
      const amountMatch = rawText.match(/([0-9,]+\.[0-9]{2})/);
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : 0;

      if (amount > 0) {
        const isIncome = /เงินเข้า|รับโอน|ได้รับเงิน/i.test(rawText);
        const type = isIncome ? "income" : "expense";
        const today = new Date().toISOString().split("T")[0];

        const ruleKey = Object.keys(rawData.bankRules || {}).find(k => rawText.toLowerCase().includes(k));
        const rule = ruleKey ? rawData.bankRules[ruleKey] : null;

        rawData.transactions.push({
          id: Date.now(),
          date: today,
          type: rule ? rule.type : type,
          category: rule ? rule.category : (isIncome ? "รายได้พิเศษ" : "รายจ่ายนอกแผน"),
          name: rule ? rule.name : `[${appName}] ${rawText}`,
          amount: amount,
          destination: "กระแสเงินสด",
          source: "bank",
          bankParty: appName,
          needsReview: !rule
        });

        await dbStore.setJSON("db", rawData);
      }

      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  if (req.method === "GET") {
    let data = await dbStore.get("db", { type: "json" }) || {
      transactions: [],
      plans: [],
      debts: [],
      myDebts: [],
      bankRules: {},
      categories: []
    };
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  if (req.method === "POST") {
    try {
      let body = await req.json();
      await dbStore.setJSON("db", body);
      return new Response(JSON.stringify({ status: "success" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
  }

  return new Response("Not Found", { status: 404 });
};
