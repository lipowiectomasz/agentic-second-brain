import type { AccessMatrix } from "@cortex/access";
import { SectorSwatch } from "@/components/sectors/sector-swatch";
import { OrgAdminToggle } from "./org-admin-toggle";
import { RoleCell } from "./role-cell";

export function AccessMatrixTable({ matrix }: { matrix: AccessMatrix }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 bg-white">
          <tr>
            <th className="sticky left-0 bg-white py-2 pr-4">Member</th>
            <th className="px-2">Org admin</th>
            <th className="px-2">Spine</th>
            {matrix.sectors.map((sector) => (
              <th key={sector.id} className="px-2">
                <span className="inline-flex items-center gap-1">
                  <SectorSwatch color={sector.color} />
                  {sector.name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.userId} className="border-t">
              <th scope="row" className="sticky left-0 bg-white py-2 pr-4 font-normal">
                <span className="block font-medium">{row.name}</span>
                <span className="block text-xs">{row.email}</span>
              </th>
              <td className="px-2">
                <OrgAdminToggle userId={row.userId} userName={row.name} isAdmin={row.isOrgAdmin} />
              </td>
              <td className="px-2">Read</td>
              {matrix.sectors.map((sector) => (
                <td key={sector.id} className="px-2">
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
