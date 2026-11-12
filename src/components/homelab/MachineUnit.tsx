import Link from "next/link";
import type { CSSProperties } from "react";
import type { HomelabNode, MachineForm } from "@/content/network-layout";
import type { Dictionary } from "@/i18n/dictionaries";

/** The rack units a machine takes, by its silhouette: a scale, not a measurement. */
export const UNITS: Record<MachineForm, number> = { "mini-pc": 2, tower: 4, box: 2 };

/** The homelab's machines: the nodes with a silhouette, in file order. */
export function machinesOf(nodes: HomelabNode[]): HomelabNode[] {
  return nodes.filter((node) => node.form);
}

/** Where each machine starts in the rack, counting from U01. */
export function rackSlots(machines: HomelabNode[]): number[] {
  let next = 1;
  return machines.map((machine) => {
    const slot = next;
    next += UNITS[machine.form ?? "box"];
    return slot;
  });
}

/** What a node hosts, each a tray — and a VM's own, inside its tray. */
function Services({ nodes, parent, kinds }: { nodes: HomelabNode[]; parent: string; kinds: Dictionary["network"]["kinds"] }) {
  const hosted = nodes.filter((node) => node.parent === parent);
  if (hosted.length === 0) return null;
  return (
    <ul className="machine-services">
      {hosted.map((node, i) => (
        <li key={node.id} data-service={node.id} data-kind={node.kind} className="service" style={{ "--blink": `${i * 0.37}s` } as CSSProperties}>
          <span aria-hidden="true" className="service-led" />
          <span className="service-name">{node.label}</span>
          <span className="service-kind">{kinds[node.kind]}</span>
          {node.project && (
            <Link href={node.project.href} lang={node.project.lang} className="service-link">
              → {node.project.title}
            </Link>
          )}
          <Services nodes={nodes} parent={node.id} kinds={kinds} />
        </li>
      ))}
    </ul>
  );
}

interface MachineUnitProps {
  machine: HomelabNode;
  nodes: HomelabNode[];
  dict: Dictionary;
  /** Its first rack unit. */
  slot: number;
}

/**
 * One of the homelab's machines and everything it runs. On a wide screen, a
 * unit in the chapter's rack, as tall as the machine is (A): its services are
 * trays across its front, a VM a tray holding its own. On a phone, the machine
 * on a shelf, its silhouette above it, its services as a tree (B). One
 * markup, two looks: CSS chooses.
 */
export function MachineUnit({ machine, nodes, dict, slot }: MachineUnitProps) {
  const form = machine.form ?? "box";
  const units = UNITS[form];
  const runs = nodes.some((node) => node.parent === machine.id);

  return (
    <article data-machine={machine.id} className="machine" style={{ "--units": units } as CSSProperties}>
      <span aria-hidden="true" className="machine-u">
        U{String(slot).padStart(2, "0")} · {units}U
      </span>
      <span aria-hidden="true" className="machine-figure" data-form={form} />
      <header className="machine-id">
        <span aria-hidden="true" className="machine-leds">
          <i data-led="power" />
          <i data-led="activity" />
        </span>
        {machine.zone && <p className="machine-zone">{machine.zone}</p>}
        <h2 className="machine-name">{machine.label}</h2>
        {machine.hardware && <p className="machine-hardware">{machine.hardware}</p>}
        {machine.project && (
          <Link href={machine.project.href} lang={machine.project.lang} className="service-link">
            → {machine.project.title}
          </Link>
        )}
      </header>
      {runs ? (
        <Services nodes={nodes} parent={machine.id} kinds={dict.network.kinds} />
      ) : (
        <p className="machine-empty">{dict.homelabWorld.noServices}</p>
      )}
      <span aria-hidden="true" className="machine-ear" />
    </article>
  );
}
