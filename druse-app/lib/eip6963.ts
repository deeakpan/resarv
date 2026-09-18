import { ConnectorController } from "@reown/appkit-controllers";

type Eip6963Info = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

type Eip6963Detail = {
  info?: Eip6963Info;
  provider?: unknown;
};

const seen = new Set<string>();

function addAnnounced(detail: Eip6963Detail) {
  const info = detail.info;
  if (!info?.rdns || !detail.provider || seen.has(info.rdns)) return;
  seen.add(info.rdns);
  ConnectorController.addConnector({
    id: info.rdns,
    name: info.name,
    type: "ANNOUNCED",
    imageUrl: info.icon,
    info: { rdns: info.rdns, name: info.name, icon: info.icon, uuid: info.uuid },
    provider: detail.provider as never,
    chain: "eip155",
  });
}

export function registerBrowserWallets() {
  if (typeof window === "undefined") return;
  window.addEventListener("eip6963:announceProvider", ((event: Event) => {
    addAnnounced((event as CustomEvent<Eip6963Detail>).detail ?? {});
  }) as EventListener);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  window.setTimeout(() => window.dispatchEvent(new Event("eip6963:requestProvider")), 400);
}
