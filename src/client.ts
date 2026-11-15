import cockpit from "cockpit";

const SOCKET = "/run/systemd/io.systemd.SysUpdate";

export function varlinkCall(method, parameters = {}) {
  return new Promise((resolve, reject) => {
    const ch = cockpit.channel({ payload: "stream", unix: SOCKET, superuser: "require", binary: true });
    const decoder = new TextDecoder();
    let buf = "";
    let done = false;

    ch.addEventListener("message", (_ev, data) => {
        buf += decoder.decode(data, { stream: true });
        const nul = buf.indexOf("\0");

        if (nul < 0) return;

        const reply = JSON.parse(buf.slice(0, nul));
        done = true;
        ch.close();
        if (reply.error) {
          reject(Object.assign(new Error(reply.error), { name: reply.error, parameters: reply.parameters }));
        } else {
          resolve(reply.parameters ?? {});
        }
    });

    ch.addEventListener("close", (_ev, opts) => {
        if (!done)
            reject(new Error(opts.problem || "connection closed without reply"));
    });
    ch.send(new TextEncoder().encode(JSON.stringify({ method, parameters }) + "\0"));
  });
}

// Varlink has no method to enable features, so use sysupdated's D-Bus API
export async function setFeatureEnabled(feature: string, enabled: boolean): Promise<void> {
    const client = cockpit.dbus("org.freedesktop.sysupdate1", { bus: "system", superuser: "require" });
    try {
        const [targets] = await client.call("/org/freedesktop/sysupdate1",
                                            "org.freedesktop.sysupdate1.Manager", "ListTargets", []) as [[string, string, string][]];
        const host = targets.find(([cls]) => cls === "host");
        if (!host)
            throw new Error("sysupdate has no host target");
        await client.call(host[2], "org.freedesktop.sysupdate1.Target", "SetFeatureEnabled",
                          [feature, enabled ? 1 : 0, 0]);
    } finally {
        client.close();
    }
}
