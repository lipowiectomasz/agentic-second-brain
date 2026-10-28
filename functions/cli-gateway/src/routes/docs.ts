import { routes } from "@cortex/gateway-contract";
import { reserveDocId, setDocumentStatus } from "@cortex/knowledge";
import { route } from "../router";
import { writeDeps } from "./deps";

export const docsReserveRoute = route(routes.docsReserve, async (ctx, input) => {
  const reservation = await reserveDocId(writeDeps(ctx), ctx.caller, input);
  return { docId: reservation.docId, reservedUntil: reservation.expiresAt };
});

export const docsStatusRoute = route(routes.docsStatus, async (ctx, input) => setDocumentStatus(writeDeps(ctx), ctx.caller, input));
