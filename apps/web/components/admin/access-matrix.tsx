import type { AccessMatrix } from "@cortex/access";
import { SectorBadge } from "@/components/sectors/sector-badge";
import { OrgAdminToggle } from "./org-admin-toggle";
import { RoleCell } from "./role-cell";

export function AccessMatrixTable({ matrix }: { matrix: AccessMatrix }) {
  return (
    <div className="tbl-box mt-3" style={{ maxHeight: "70vh" }}>
      <table className="tbl">
        <thead>
          <tr>
            <th className="sticky-col">Member</th>
            <th>Org admin</th>
            <th>Spine</th>
            {matrix.sectors.map((sector) => (
              <th key={sector.id}>
                <SectorBadge name={sector.name} color={sector.color} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.userId}>
              <th scope="row" className="sticky-col" style={{ textTransform: "none", letterSpacing: 0, font: "inherit", color: "inherit", borderBottom: "1px solid var(--border)", position: "sticky" }}>
                <span className="block font-medium">{row.name}</span>
                <span className="mono xsmall muted block">{row.email}</span>
              </th>
              <td>
                <OrgAdminToggle userId={row.userId} userName={row.name} isAdmin={row.isOrgAdmin} />
              </td>
              <td>
                <span className="badge badge-muted">Read</span>
              </td>
              {matrix.sectors.map((sector) => (
                <td key={sector.id}>
                  <RoleCell userId={row.userId} userName={row.name} sectorId={sector.id} sectorName={sector.name} role={row.roles[sector.id] ?? null} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
