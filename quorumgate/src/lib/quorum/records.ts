import type { CustomerRecord } from "./types";

// SAMPLE DATA — every name and number below is fictional and generated for the demo.
// In production this would come from the bank's ledger database.
export const LEDGER: CustomerRecord[] = [
  { id: "C-10421", name: "Nur Aisyah Binti Rahman", nationalId: "900514-14-5522", card: "4539 1488 0343 6467", balance: "RM 482,190.55", risk: "LOW" },
  { id: "C-10422", name: "Tan Wei Ming", nationalId: "870302-10-6011", card: "5425 2334 3010 9903", balance: "RM 1,204,880.10", risk: "HIGH" },
  { id: "C-10423", name: "Rajesh Kumar a/l Subramaniam", nationalId: "920811-08-7765", card: "4716 9031 2287 4410", balance: "RM 77,312.00", risk: "MEDIUM" },
  { id: "C-10424", name: "Nguyen Thi Lan", nationalId: "A12345678", card: "3782 822463 10005", balance: "RM 15,960.42", risk: "LOW" },
  { id: "C-10425", name: "Siti Hajar Binti Osman", nationalId: "011120-03-4458", card: "6011 0009 9013 9424", balance: "RM 3,401,775.90", risk: "HIGH" },
  { id: "C-10426", name: "Daniel Lim Jun Hao", nationalId: "950727-07-1139", card: "4024 0071 8811 2287", balance: "RM 268,004.31", risk: "MEDIUM" },
];

function mask(value: string, keep: number): string {
  const visible = value.slice(-keep);
  return value.slice(0, -keep).replace(/[A-Za-z0-9]/g, "•") + visible;
}

/** What every admin sees by default: enough to operate, not enough to exfiltrate. */
export function maskedLedger(): CustomerRecord[] {
  return LEDGER.map((r) => ({
    ...r,
    name: r.name.split(" ").map((w) => w[0] + "•".repeat(Math.max(w.length - 1, 1))).join(" "),
    nationalId: mask(r.nationalId, 2),
    card: mask(r.card, 4),
    balance: "RM •••,•••.••",
  }));
}
