import { Prisma } from '@prisma/client';

// BR-01: format TK-YYYYMMDD-[4-digit counter], date = Asia/Bangkok local date,
// counter resets to 0001 each calendar day.

export async function generateTicketNo(
  tx: Prisma.TransactionClient
): Promise<string> {
  const now = new Date();
  const dateStr = now
    .toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' })
    .replace(/-/g, '');
  const prefix = `TK-${dateStr}-`;

  const lastTicket = await tx.ticket.findFirst({
    where: { ticketNo: { startsWith: prefix } },
    orderBy: { ticketNo: 'desc' },
  });

  let nextSeq = 1;
  if (lastTicket?.ticketNo) {
    const lastSeq = parseInt(lastTicket.ticketNo.split('-')[2], 10);
    nextSeq = lastSeq + 1;
  }

  const paddedSeq = String(nextSeq).padStart(4, '0');
  return `${prefix}${paddedSeq}`;
}