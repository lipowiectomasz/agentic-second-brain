import type { TokenView } from "@cortex/tokens";
import { longDate } from "@/lib/dates";
import { RevokeButton } from "./revoke-button";

const statusBadges = { active: ["badge-success", "Active"], expired: ["badge-muted", "Expired"], revoked: ["badge-danger", "Revoked"] } as const;

export function TokensTable({ tokens, showOwner = false }: { tokens: Array<TokenView & { ownerName?: string }>; showOwner?: boolean }) {
  if (tokens.length === 0) return <p className="small muted">No tokens yet.</p>;
  return (
    <div className="tbl-box">
      <table className="tbl min-w-[760px]">
        <thead>
          <tr>
            <th className="sticky-col">Name</th>
            {showOwner && <th>Owner</th>}
            <th>Scope</th>
            <th>Created</th>
            <th>Expires</th>
            <th>Last used</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => {
            const [badge, label] = statusBadges[token.status];
            return (
              <tr key={token.id}>
                <td className="sticky-col">
                  <div className="flex flex-col">
                    <span className={`font-medium ${token.status === "active" ? "" : "muted"}`}>{token.name}</span>
                    <span className="mono xsmall muted">{token.prefix}</span>
                  </div>
                </td>
                {showOwner && <td className="small">{token.ownerName}</td>}
                <td className="small">{token.scope === "read" ? "Read only" : "Read and write"}</td>
                <td className="small muted whitespace-nowrap">{longDate(token.createdAt)}</td>
                <td className="small muted whitespace-nowrap">{longDate(token.expiresAt)}</td>
                <td className="small muted whitespace-nowrap">{token.lastUsedAt === null ? "Never" : longDate(token.lastUsedAt)}</td>
                <td>
                  <span className={`badge ${badge}`}>{label}</span>
                </td>
                <td className="text-right">{token.status === "active" && <RevokeButton tokenId={token.id} name={token.name} prefix={token.prefix} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
